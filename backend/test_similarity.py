
from pathlib import Path
from image_similarity import compare_images

folder = Path(__file__).parent

image_path = folder / "test_disaster.png"

image_bytes = image_path.read_bytes()

print("Comparing disaster image with itself...")

score = compare_images(image_bytes, image_bytes)

print("AI similarity score:", score)
