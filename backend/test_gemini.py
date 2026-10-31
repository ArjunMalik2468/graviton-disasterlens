
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image

load_dotenv(Path(__file__).with_name(".env"))

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY not found")

client = genai.Client(api_key=api_key)

image_path = Path(__file__).with_name("test_disaster.png")

if not image_path.exists():
    raise FileNotFoundError(
        "Place an image named test_disaster.png inside backend"
    )

with Image.open(image_path) as image:
    image.verify()

image_bytes = image_path.read_bytes()

print("Analyzing disaster image...")

response = client.models.generate_content(
    model="gemini-flash-lite-latest",
    contents=[
        types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/png"
        ),
        """Analyze this disaster-report photograph.

        1. Describe only what is visibly present.
        2. Identify possible disaster-related evidence.
        3. State whether the image shows flooding,
           landslide damage, storm damage, or none.
        4. Mention any uncertainty.

        Do not invent locations, dates, or events.
        Do not claim that the image is authentic.
        """
    ]
)

print("\nAI ANALYSIS:\n")
print(response.text or "No text response returned")
