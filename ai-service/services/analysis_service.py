from models.captioning import generate_caption
from models.classification import (
    classify_image,
    map_label_to_category,
    is_non_civic_label,
)
from models.reasoning import (
    estimate_severity,
    calculate_confidence_score,
    calculate_fake_report_likelihood,
    calculate_severity_confidence,
    calculate_duplicate_likelihood,
    build_reasoning,
    generate_title,
    generate_refined_description,
)


def build_analysis_payload(image) -> dict:
    caption = generate_caption(image)

    classification = classify_image(image)

    top_label = classification["top_label"]
    top_score = classification["top_score"]

    category = map_label_to_category(top_label)

    valid_issue = not is_non_civic_label(top_label) and top_score >= 0.16

    severity = estimate_severity(
        caption=caption,
        top_label=top_label,
        top_score=top_score,
    )

    confidence_score = calculate_confidence_score(
        top_label=top_label,
        top_score=top_score,
        valid_issue=valid_issue,
    )

    fake_report_likelihood = calculate_fake_report_likelihood(
        caption=caption,
        top_label=top_label,
        top_score=top_score,
        valid_issue=valid_issue,
    )

    severity_confidence = calculate_severity_confidence(
        caption=caption,
        severity=severity,
        top_label=top_label,
        top_score=top_score,
    )

    duplicate_likelihood = calculate_duplicate_likelihood(
        caption=caption,
        top_label=top_label,
        top_score=top_score,
    )

    reasoning = build_reasoning(
        caption=caption,
        top_label=top_label,
        top_score=top_score,
        valid_issue=valid_issue,
        category=category,
        severity=severity,
    )

    title = generate_title(category, caption)

    refined_description = generate_refined_description(
        caption=caption,
        category=category,
        severity=severity,
        top_label=top_label,
        top_score=top_score,
    )

    if valid_issue:
        ai_description = (
            f"AI detected a potential civic infrastructure issue. "
            f"The image appears to show: '{caption}'. "
            f"The strongest visual match is '{top_label}'. "
            f"Estimated severity level is {severity.lower()}."
        )
    else:
        ai_description = (
            f"AI could not confidently verify this as a civic issue. "
            f"Detected scene: '{caption}'. "
            f"Top visual match: '{top_label}'."
        )

    return {
        "is_valid_issue": valid_issue,
        "title": title,
        "category": category,
        "severity": severity,
        "description": refined_description,
        "ai_description": ai_description,
        "caption": caption,
        "raw_caption": caption,
        "confidence_score": confidence_score,
        "fake_report_likelihood": fake_report_likelihood,
        "severity_confidence": severity_confidence,
        "duplicate_likelihood": duplicate_likelihood,
        "reasoning": reasoning,
        "classification": classification,
    }


def analyze_image(image) -> dict:
    payload = build_analysis_payload(image)

    return {
        "is_valid_issue": payload["is_valid_issue"],
        "confidence_score": payload["confidence_score"],
        "fake_report_likelihood": payload["fake_report_likelihood"],
        "severity": payload["severity"],
        "severity_confidence": payload["severity_confidence"],
        "duplicate_likelihood": payload["duplicate_likelihood"],
        "description": payload["ai_description"],
        "reasoning": payload["reasoning"],
        "raw_caption": payload["raw_caption"],
        "classification": payload["classification"],
    }


def analyze_preview_image(image) -> dict:
    payload = build_analysis_payload(image)

    return {
        "is_valid_issue": payload["is_valid_issue"],
        "title": payload["title"],
        "category": payload["category"],
        "severity": payload["severity"],
        "description": payload["description"],
        "caption": payload["caption"],
        "confidence_score": payload["confidence_score"],
        "fake_report_likelihood": payload["fake_report_likelihood"],
        "severity_confidence": payload["severity_confidence"],
        "duplicate_likelihood": payload["duplicate_likelihood"],
        "reasoning": payload["reasoning"],
        "classification": payload["classification"],
    }
