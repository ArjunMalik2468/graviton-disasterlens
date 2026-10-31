
import io

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch32"

print("Loading CLIP image similarity model...")

processor = CLIPProcessor.from_pretrained(MODEL_NAME)
model = CLIPModel.from_pretrained(MODEL_NAME)
model.eval()

print("CLIP model loaded successfully!")


def get_image_embedding(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    with torch.inference_mode():
        # Use the vision encoder's pooled representation
        vision_output = model.vision_model(
            pixel_values=inputs["pixel_values"]
        )

        pooled_output = vision_output.pooler_output

        # Project into CLIP's shared embedding space
        embedding = model.visual_projection(pooled_output)

        # Normalize for cosine similarity
        embedding = torch.nn.functional.normalize(
            embedding,
            p=2,
            dim=-1
        )

    return embedding


def compare_images(image1_bytes, image2_bytes):
    embedding1 = get_image_embedding(image1_bytes)
    embedding2 = get_image_embedding(image2_bytes)

    similarity = torch.nn.functional.cosine_similarity(
        embedding1,
        embedding2,
        dim=-1
    ).item()

    return round(similarity, 4)
