from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io

from services.analysis_service import analyze_image, analyze_preview_image
from services.duplicate_service import (
    compare_issue_similarity
)

from pydantic import BaseModel, Field, ConfigDict


class DuplicateCheckRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_text: str = Field(alias="sourceText") 
    candidate_texts: list[str] = Field(alias="candidateTexts")

app = FastAPI(title="CivicSense AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_image(contents: bytes) -> Image.Image:
    return Image.open(io.BytesIO(contents)).convert("RGB")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "civicsense-ai",
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = read_image(contents)
        return analyze_image(image)

    except Exception as e:
        return {
            "error": str(e)
        }


@app.post("/analyze-preview")
async def analyze_preview(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = read_image(contents)
        return analyze_preview_image(image)

    except Exception as e:
        return {
            "error": str(e)
        }
@app.post("/duplicate-check")
async def duplicate_check(
    request: DuplicateCheckRequest
):

    try:

        scores = compare_issue_similarity(
            request.source_text,
            request.candidate_texts
        )

        return {
            "scores": scores
        }

    except Exception as e:

        return {
            "error": str(e)
        }   