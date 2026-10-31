
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load API key from backend/.env
load_dotenv(Path(__file__).with_name(".env"))

# This model has already worked with your API key.
MODEL_NAME = "gemini-flash-lite-latest"


def analyze_disaster_image(
    image_bytes,
    mime_type,
    disaster_type,
    description
):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing")

    # Timeout after 30 seconds
    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=90000
        )
    )

    # Short prompt for concise disaster analysis
    prompt = f"""
You are an AI assistant helping a human disaster-report reviewer.

Reported disaster type: {disaster_type}
Report description: {description}

Analyze the attached image.

Respond briefly using these five points:

1. Visible disaster type
2. Key visual evidence (maximum 2 observations)
3. Does the image visually match the report?
4. Possible CGI or manipulation indicators
5. Uncertainties and limitations

Rules:
- Keep the response under 100 words.
- Do not invent a location, date, or event.
- Do not claim an image is definitely real or fake.
- Do not automatically approve or reject reports.
- Mention when visual evidence is insufficient.
"""
    import io
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("RGB")
    image.thumbnail((768, 768))

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=75)

    optimized_image = buffer.getvalue()
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[
            types.Part.from_bytes(
                data=optimized_image,
                mime_type="image/jpeg"
            ),
            prompt
        ],
        config=types.GenerateContentConfig(
            max_output_tokens=250,
            temperature=0.2
        )
    )

    return {
        "model": MODEL_NAME,
        "analysis": response.text or "No analysis returned"
    }
