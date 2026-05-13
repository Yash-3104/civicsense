from transformers import pipeline

from utils.civic_rules import (
    CANDIDATE_LABELS,
    CATEGORY_MAPPING,
    NON_CIVIC_LABELS,
    CIVIC_LABELS,
    NON_CIVIC_HINTS,
    MIN_CIVIC_CONFIDENCE,
    MIN_CIVIC_MARGIN_OVER_NON_CIVIC,
    POTHOLE_WATER_OVERRIDE_MARGIN,
    POTHOLE_WATER_OVERRIDE_MIN_SCORE,
    WATER_LABELS,
    POTHOLE_LABELS,
    WATER_INFRA_HINTS,
    ROAD_CONTEXT_HINTS,
)

CLASSIFICATION_MODEL_NAME = "openai/clip-vit-base-patch32"

classifier = pipeline(
    task="zero-shot-image-classification",
    model=CLASSIFICATION_MODEL_NAME,
)


def _score_for(results: list[dict], label: str) -> float:
    for item in results:
        if item.get("label") == label:
            return float(item.get("score", 0.0))
    return 0.0


def _best_score_for(results: list[dict], labels: set[str]) -> tuple[str | None, float]:
    best_label = None
    best_score = 0.0

    for item in results:
        label = item.get("label")
        score = float(item.get("score", 0.0))

        if label in labels and score > best_score:
            best_label = label
            best_score = score

    return best_label, best_score


def _contains_any(text: str, keywords: list[str]) -> bool:
    text_lower = (text or "").lower()
    return any(keyword in text_lower for keyword in keywords)


def _choose_effective_label(
    normalized_results: list[dict],
    caption: str,
) -> tuple[str, float, list[str]]:
    top = normalized_results[0]
    top_label = top["label"]
    top_score = float(top["score"])
    notes = []

    caption_lower = (caption or "").lower()

    pothole_label, pothole_score = _best_score_for(
        normalized_results,
        POTHOLE_LABELS,
    )

    water_label, water_score = _best_score_for(
        normalized_results,
        WATER_LABELS,
    )

    has_water_infra_cue = _contains_any(
        caption_lower,
        WATER_INFRA_HINTS,
    )

    has_road_context = _contains_any(
        caption_lower,
        ROAD_CONTEXT_HINTS,
    )

    # Potholes with standing water often look like water/sewage to CLIP.
    # If pothole/road-damage is close and there is no pipe/drain/sewage cue,
    # prefer pothole because the issue is primarily road damage.
    if (
        top_label in WATER_LABELS
        and pothole_label is not None
        and pothole_score >= POTHOLE_WATER_OVERRIDE_MIN_SCORE
        and (water_score - pothole_score) <= POTHOLE_WATER_OVERRIDE_MARGIN
        and has_road_context
        and not has_water_infra_cue
    ):
        notes.append(
            f"Water-like label '{top_label}' was overridden to '{pothole_label}' because pothole/road-damage was close and no pipe/drain/sewage cue was detected."
        )
        return pothole_label, round(pothole_score, 4), notes

    return top_label, round(top_score, 4), notes


def classify_image(image, caption: str = "") -> dict:
    results = classifier(
        image,
        candidate_labels=CANDIDATE_LABELS,
    )

    if not results:
        return {
            "top_label": "non-civic scene",
            "top_score": 0.0,
            "all_labels": [],
            "valid_issue": False,
            "fake_report_likelihood": 0.95,
            "reasoning": ["Classifier returned no labels."],
        }

    normalized_results = [
        {
            "label": item.get("label"),
            "score": float(item.get("score", 0.0)),
        }
        for item in results
    ]

    top_label, top_score, override_notes = _choose_effective_label(
        normalized_results,
        caption,
    )

    best_civic_label, best_civic_score = _best_score_for(
        normalized_results,
        CIVIC_LABELS,
    )

    best_non_civic_label, best_non_civic_score = _best_score_for(
        normalized_results,
        NON_CIVIC_LABELS,
    )

    caption_lower = (caption or "").lower()

    non_civic_caption_hit = any(
        word in caption_lower
        for word in NON_CIVIC_HINTS
    )

    valid_issue = (
        top_label in CIVIC_LABELS
        and top_score >= MIN_CIVIC_CONFIDENCE
    )

    # Reject obvious non-civic captions like "a rock on a white background".
    if non_civic_caption_hit:
        valid_issue = False

    # Reject cases where a civic label barely beats random-object style labels.
    # This fixes rock/stone images being accepted as potholes.
    if (
        top_label in CIVIC_LABELS
        and best_non_civic_score > 0
        and (top_score - best_non_civic_score) < MIN_CIVIC_MARGIN_OVER_NON_CIVIC
    ):
        valid_issue = False

    if top_label not in CIVIC_LABELS:
        valid_issue = False

    if not valid_issue:
        fake_report_likelihood = round(max(0.7, 1 - top_score), 2)
    else:
        fake_report_likelihood = round(max(0.05, 0.3 - top_score / 2), 2)

    reasoning = []

    reasoning.append(
        f"CLIP classified the image as '{top_label}' with confidence score {top_score}."
    )

    reasoning.extend(override_notes)

    if best_non_civic_label:
        reasoning.append(
            f"Closest non-civic label was '{best_non_civic_label}' with score {round(best_non_civic_score, 4)}."
        )

    if non_civic_caption_hit:
        reasoning.append(
            "Caption contains strong non-civic object/background cues, so the report was rejected."
        )

    if valid_issue:
        reasoning.append(
            "Classification confidence passed civic infrastructure threshold."
        )
    else:
        reasoning.append(
            "Image classification confidence for civic infrastructure is too low or ambiguous."
        )

    if top_label in NON_CIVIC_LABELS:
        reasoning.append(
            "Detected image appears non-civic or unrelated to public infrastructure."
        )

    return {
        "top_label": top_label,
        "top_score": top_score,
        "all_labels": normalized_results,
        "best_civic_label": best_civic_label,
        "best_civic_score": round(best_civic_score, 4),
        "best_non_civic_label": best_non_civic_label,
        "best_non_civic_score": round(best_non_civic_score, 4),
        "valid_issue": valid_issue,
        "fake_report_likelihood": fake_report_likelihood,
        "reasoning": reasoning,
    }


def map_label_to_category(label: str) -> str:
    if not label:
        return "POTHOLE"

    return CATEGORY_MAPPING.get(label, "POTHOLE")


def is_non_civic_label(label: str) -> bool:
    return label in NON_CIVIC_LABELS
