from fastapi import FastAPI, UploadFile, File
from PIL import Image

from transformers import (
    BlipProcessor,
    BlipForConditionalGeneration,
)

import torch
import io

app = FastAPI()

# ---------------------------------------------------
# Load BLIP model once
# ---------------------------------------------------

processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

device = "cuda" if torch.cuda.is_available() else "cpu"

model.to(device)

# ---------------------------------------------------
# Civic keywords
# ---------------------------------------------------

CIVIC_KEYWORDS = [
    "road",
    "street",
    "pothole",
    "garbage",
    "trash",
    "water",
    "pipe",
    "flood",
    "leak",
    "traffic",
    "light",
    "pole",
    "drain",
    "sidewalk",
    "sewage",
    "construction",
]

# ---------------------------------------------------
# Severity estimation
# ---------------------------------------------------

def estimate_severity(caption: str):

    caption_lower = caption.lower()

    high_keywords = [
        "flood",
        "collapsed",
        "broken",
        "damaged",
        "large",
        "huge",
        "fire",
    ]

    medium_keywords = [
        "water",
        "garbage",
        "trash",
        "crack",
        "pothole",
    ]

    if any(word in caption_lower for word in high_keywords):
        return "HIGH"

    if any(word in caption_lower for word in medium_keywords):
        return "MEDIUM"

    return "LOW"

# ---------------------------------------------------
# Civic issue validation
# ---------------------------------------------------

def is_civic_issue(caption: str):

    caption_lower = caption.lower()

    return any(
        keyword in caption_lower
        for keyword in CIVIC_KEYWORDS
    )

# ---------------------------------------------------
# Generate image caption
# ---------------------------------------------------

def generate_caption(image):

    inputs = processor(
        image,
        return_tensors="pt"
    ).to(device)

    output = model.generate(
        **inputs,
        max_new_tokens=30
    )

    caption = processor.decode(
        output[0],
        skip_special_tokens=True
    )

    return caption

# ---------------------------------------------------
# Main endpoint
# ---------------------------------------------------

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    try:

        contents = await file.read()

        image = Image.open(
            io.BytesIO(contents)
        ).convert("RGB")

        # ---------------------------------------------------
        # AI caption generation
        # ---------------------------------------------------

        caption = generate_caption(image)

        # ---------------------------------------------------
        # Civic detection
        # ---------------------------------------------------

        valid_issue = is_civic_issue(caption)

        severity = estimate_severity(caption)

        # ---------------------------------------------------
        # Dynamic AI description
        # ---------------------------------------------------

        if valid_issue:

            ai_description = (
                f"AI detected a potential civic "
                f"infrastructure issue. "
                f"The image appears to show: "
                f"'{caption}'. "
                f"Estimated severity level is "
                f"{severity.lower()}."
            )

        else:

            ai_description = (
                f"AI could not confidently verify "
                f"this as a civic issue. "
                f"Detected scene: '{caption}'."
            )

        return {
            "is_valid_issue": valid_issue,
            "severity": severity,
            "description": ai_description,
            "raw_caption": caption,
        }

    except Exception as e:

        return {
            "error": str(e)
        }