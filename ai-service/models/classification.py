from transformers import pipeline

from utils.civic_rules import (
    CANDIDATE_LABELS,
    CATEGORY_MAPPING,
    NON_CIVIC_LABELS,
    CIVIC_LABELS,
    NON_CIVIC_HINTS,
    MIN_CIVIC_CONFIDENCE,
)

CLASSIFICATION_MODEL_NAME = "openai/clip-vit-base-patch32"

classifier = pipeline(
    task="zero-shot-image-classification",
    model=CLASSIFICATION_MODEL_NAME,
)


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
        }

    normalized_results = [
        {
            "label": item.get("label"),
            "score": float(item.get("score", 0.0)),
        }
        for item in results
    ]

    top = normalized_results[0]

    top_label = top["label"]

    top_score = round(top["score"], 4)

    valid_issue = (
        top_label in CIVIC_LABELS
        and top_score >= MIN_CIVIC_CONFIDENCE
    )

    if top_label not in CIVIC_LABELS:
        valid_issue = False

    caption_lower = caption.lower()

    if any(
        word in caption_lower
        for word in NON_CIVIC_HINTS
    ):
        valid_issue = False

    if not valid_issue:

        fake_report_likelihood = round(
            max(0.7, 1 - top_score),
            2
        )

    else:

        fake_report_likelihood = round(
            max(0.05, 0.3 - top_score / 2),
            2
        )

    reasoning = []

    reasoning.append(
        f"CLIP classified the image as '{top_label}' with confidence score {top_score}."
    )

    if valid_issue:

        reasoning.append(
            "Classification confidence passed civic infrastructure threshold."
        )

    else:

        reasoning.append(
            "Image classification confidence for civic infrastructure is too low."
        )

    if top_label in NON_CIVIC_LABELS:

        reasoning.append(
            "Detected image appears non-civic or unrelated to public infrastructure."
        )

    return {
        "top_label": top_label,
        "top_score": top_score,
        "all_labels": normalized_results,
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