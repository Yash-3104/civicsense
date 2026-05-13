from utils.civic_rules import (
    HIGH_SEVERITY_KEYWORDS,
    MEDIUM_SEVERITY_KEYWORDS,
    HIGH_SEVERITY_LABELS,
    MEDIUM_SEVERITY_LABELS,
    NON_CIVIC_HINTS,
    NON_CIVIC_LABELS,
    TITLE_BY_CATEGORY,
)


def clamp_score(value: float, minimum: float = 0.02, maximum: float = 0.98) -> float:
    return round(max(minimum, min(float(value), maximum)), 2)


def contains_any(text: str, keywords: list[str]) -> bool:
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in keywords)


def estimate_severity(caption: str, top_label: str, top_score: float) -> str:
    caption_lower = caption.lower()

    if top_label in HIGH_SEVERITY_LABELS and top_score >= 0.25:
        return "HIGH"

    if contains_any(caption_lower, HIGH_SEVERITY_KEYWORDS):
        return "HIGH"

    if top_label in MEDIUM_SEVERITY_LABELS and top_score >= 0.18:
        return "MEDIUM"

    if contains_any(caption_lower, MEDIUM_SEVERITY_KEYWORDS):
        return "MEDIUM"

    return "LOW"


def calculate_confidence_score(top_label: str, top_score: float, valid_issue: bool) -> float:
    if not valid_issue:
        return clamp_score(0.35 * (1 - top_score), 0.05, 0.45)

    # CLIP zero-shot scores can be modest even for correct labels,
    # so convert the top score into a usable product confidence.
    confidence = 0.58 + (top_score * 0.42)

    return clamp_score(confidence, 0.55, 0.97)


def calculate_fake_report_likelihood(
    caption: str,
    top_label: str,
    top_score: float,
    valid_issue: bool,
) -> float:
    caption_lower = caption.lower()
    non_civic_hint_count = sum(
        1 for hint in NON_CIVIC_HINTS
        if hint in caption_lower
    )

    if top_label in NON_CIVIC_LABELS:
        return clamp_score(0.62 + top_score * 0.3 + non_civic_hint_count * 0.04)

    if not valid_issue:
        return clamp_score(0.68 + non_civic_hint_count * 0.06)

    return clamp_score(0.22 - min(top_score * 0.12, 0.16), 0.03, 0.35)


def calculate_severity_confidence(
    caption: str,
    severity: str,
    top_label: str,
    top_score: float,
) -> float:
    caption_lower = caption.lower()

    if severity == "HIGH":
        keyword_matches = sum(
            1 for keyword in HIGH_SEVERITY_KEYWORDS
            if keyword in caption_lower
        )
        return clamp_score(0.62 + top_score * 0.22 + keyword_matches * 0.04)

    if severity == "MEDIUM":
        keyword_matches = sum(
            1 for keyword in MEDIUM_SEVERITY_KEYWORDS
            if keyword in caption_lower
        )
        return clamp_score(0.58 + top_score * 0.2 + keyword_matches * 0.035)

    return clamp_score(0.52 + top_score * 0.12, 0.35, 0.75)


def calculate_duplicate_likelihood(caption: str, top_label: str, top_score: float) -> float:
    # Temporary pre-duplicate signal.
    # Real duplicate detection later should use geo distance + caption/CLIP embeddings.
    repeated_terms = [
        "road",
        "street",
        "pothole",
        "water",
        "garbage",
        "traffic",
        "leak",
        "drain",
    ]

    caption_lower = caption.lower()

    matches = sum(
        1 for term in repeated_terms
        if term in caption_lower
    )

    label_bonus = 0.05 if top_label not in NON_CIVIC_LABELS else 0.0

    return clamp_score(0.08 + matches * 0.035 + top_score * 0.08 + label_bonus, 0.04, 0.5)


def build_reasoning(
    caption: str,
    top_label: str,
    top_score: float,
    valid_issue: bool,
    category: str,
    severity: str,
) -> list[str]:
    reasoning = []
    confidence_percent = round(top_score * 100)

    if valid_issue:
        reasoning.append(
            f"CLIP classified the image as '{top_label}' with {confidence_percent}% semantic match."
        )

        reasoning.append(
            f"The detected label maps to CivicSense category {category}."
        )

        if "road" in caption.lower() or "street" in caption.lower():
            reasoning.append(
                "Road or street context is visible in the generated caption."
            )

        if category == "WATER_LEAK":
            reasoning.append(
                "Water leakage or flooding cues influenced the category suggestion."
            )

        if category == "GARBAGE":
            reasoning.append(
                "Waste accumulation cues influenced the category suggestion."
            )

        if category == "STREETLIGHT":
            reasoning.append(
                "Streetlight or pole-related cues influenced the category suggestion."
            )

        if category == "POTHOLE":
            reasoning.append(
                "Road damage or obstruction cues influenced the category suggestion."
            )

        reasoning.append(
            f"Severity was refined to {severity.lower()} using ML classification plus caption heuristics."
        )

    else:
        reasoning.append(
            f"Top visual label was '{top_label}', which does not strongly match civic issue classes."
        )
        reasoning.append(
            "The image may be unrelated, unclear, or not useful for civic verification."
        )

    return reasoning


def generate_title(category: str, caption: str) -> str:
    if category in TITLE_BY_CATEGORY:
        return TITLE_BY_CATEGORY[category]

    cleaned_caption = caption.strip().capitalize()

    if not cleaned_caption:
        return "Civic issue reported"

    return cleaned_caption[:70]


def generate_refined_description(
    caption: str,
    category: str,
    severity: str,
    top_label: str,
    top_score: float,
) -> str:
    confidence_percent = round(top_score * 100)

    return (
        f"AI detected a possible {category.lower().replace('_', ' ')} issue. "
        f"The uploaded image appears to show '{caption}'. "
        f"The visual classifier matched this as '{top_label}' with "
        f"{confidence_percent}% semantic confidence. "
        f"Estimated severity level is {severity.lower()}."
    )