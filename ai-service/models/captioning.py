import torch
from transformers import BlipProcessor, BlipForConditionalGeneration

CAPTION_MODEL_NAME = "Salesforce/blip-image-captioning-base"

device = "cuda" if torch.cuda.is_available() else "cpu"

processor = BlipProcessor.from_pretrained(CAPTION_MODEL_NAME)
model = BlipForConditionalGeneration.from_pretrained(CAPTION_MODEL_NAME)
model.to(device)


def generate_caption(image) -> str:
    inputs = processor(
        image,
        return_tensors="pt"
    ).to(device)

    output = model.generate(
        **inputs,
        max_new_tokens=35
    )

    caption = processor.decode(
        output[0],
        skip_special_tokens=True
    )

    return caption.strip()
