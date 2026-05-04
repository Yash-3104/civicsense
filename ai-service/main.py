from fastapi import FastAPI, UploadFile, File
from PIL import Image
import io
import random

app = FastAPI()

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()

    # Fake AI logic (replace later)
    is_valid = random.choice([True, True, False])
    severity = random.choice(["LOW", "MEDIUM", "HIGH"])

    return {
        "is_valid_issue": is_valid,
        "severity": severity
    }
