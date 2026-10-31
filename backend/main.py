from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from PIL.ExifTags import TAGS, GPSTAGS
from pydantic import BaseModel
from typing import Literal
from database import connect, init_db
from ai_service import analyze_disaster_image
import imagehash
import hashlib
import io
import uuid
import math

app = FastAPI(title="DisasterLens AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

init_db()
MAX_IMAGE_SIZE = 10 * 1024 * 1024


def check_image(data):
    if not data or len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image must be under 10 MB")

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        phash = imagehash.phash(image.convert("RGB"))
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(400, "Invalid image")

    sha = hashlib.sha256(data).hexdigest()

    with connect() as db:
        matches = db.execute(
            "SELECT sha256, phash FROM reports"
        ).fetchall()

    for match in matches:
        if match["sha256"] == sha:
            return "Duplicate", "Exact image match", sha, str(phash)

    for match in matches:
        if not match["phash"]:
            continue
        try:
            distance = phash - imagehash.hex_to_hash(match["phash"])
        except (ValueError, TypeError):
            continue
        if distance <= 5:
            return "Possible Duplicate", "Visually similar image", sha, str(phash)

    return "Pending", "No matching image found", sha, str(phash)


@app.get("/")
def home():
    return {"message": "DisasterLens AI Backend Running"}


@app.post("/verify")
async def verify(file: UploadFile = File(...)):
    data = await file.read(MAX_IMAGE_SIZE + 1)
    status, reason, _, _ = check_image(data)
    return {"status": status, "reason": reason}


@app.post("/reports")
async def create_report(
    file: UploadFile = File(...),
    type: str = Form(...),
    description: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...)
):
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise HTTPException(400, "Invalid coordinates")
    if not description.strip():
        raise HTTPException(400, "Description is required")

    data = await file.read(MAX_IMAGE_SIZE + 1)
    status, reason, sha, phash = check_image(data)
    report_id = str(uuid.uuid4())
    image_status = status
    review_status = "Awaiting Review"

    with connect() as db:
        db.execute("""
            INSERT INTO reports
            (id, type, description, lat, lng, status,
             reason, sha256, phash, image_status, review_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            report_id, type, description, lat, lng,
            status, reason, sha, phash, image_status, review_status
        ))

    return {
        "id": report_id,
        "type": type,
        "description": description,
        "lat": lat,
        "lng": lng,
        "status": status,
        "reason": reason,
        "image_status": image_status,
        "review_status": review_status
    }


@app.get("/reports")
def get_reports():
    with connect() as db:
        rows = db.execute("""
            SELECT id, type, description, lat, lng,
                   status, reason, image_status,
                   review_status, created_at
            FROM reports
            ORDER BY created_at DESC, rowid DESC
        """).fetchall()
    return [dict(row) for row in rows]


class ReviewRequest(BaseModel):
    decision: Literal["Verified", "Rejected"]


@app.patch("/reports/{report_id}/review")
def review_report(report_id: str, review: ReviewRequest):
    with connect() as db:
        report = db.execute(
            "SELECT id, status, review_status FROM reports WHERE id = ?",
            (report_id,)
        ).fetchone()

        if report is None:
            raise HTTPException(404, "Report not found")
        if report["review_status"] in ("Verified", "Rejected") or report["status"] in ("Verified", "Rejected"):
            raise HTTPException(409, "Report has already been reviewed")

        db.execute(
            "UPDATE reports SET status = ?, review_status = ? WHERE id = ?",
            (review.decision, review.decision, report_id)
        )

    return {
        "id": report_id,
        "status": review.decision,
        "review_status": review.decision,
        "message": "Review saved successfully"
    }


def gps_to_decimal(value, reference):
    try:
        degrees = float(value[0])
        minutes = float(value[1])
        seconds = float(value[2])
        decimal = degrees + minutes / 60 + seconds / 3600
        if isinstance(reference, bytes):
            reference = reference.decode("ascii", errors="ignore")
        if reference in ("S", "W"):
            decimal = -decimal
        return round(decimal, 6)
    except (TypeError, ValueError, IndexError, ZeroDivisionError):
        return None


def extract_metadata(image):
    exif = image.getexif()
    result = {
        "capture_time": None,
        "gps_lat": None,
        "gps_lng": None,
        "camera_make": None,
        "camera_model": None
    }
    if not exif:
        return result

    for tag_id, value in exif.items():
        tag_name = TAGS.get(tag_id, tag_id)
        if tag_name == "DateTimeOriginal":
            result["capture_time"] = str(value)
        elif tag_name == "Make":
            result["camera_make"] = str(value)
        elif tag_name == "Model":
            result["camera_model"] = str(value)

    exif_ifd = exif.get_ifd(0x8769)
    if exif_ifd.get(36867):
        result["capture_time"] = str(exif_ifd[36867])

    gps_ifd = exif.get_ifd(0x8825)
    if gps_ifd:
        gps = {GPSTAGS.get(key, key): value for key, value in gps_ifd.items()}
        lat = gps.get("GPSLatitude")
        lat_ref = gps.get("GPSLatitudeRef")
        lng = gps.get("GPSLongitude")
        lng_ref = gps.get("GPSLongitudeRef")
        if lat and lat_ref and lng and lng_ref:
            result["gps_lat"] = gps_to_decimal(lat, lat_ref)
            result["gps_lng"] = gps_to_decimal(lng, lng_ref)
    return result


@app.post("/metadata")
async def analyze_metadata(file: UploadFile = File(...)):
    data = await file.read(MAX_IMAGE_SIZE + 1)
    if not data or len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image must be under 10 MB")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        metadata = extract_metadata(image)
    except (UnidentifiedImageError, OSError, ValueError, TypeError):
        raise HTTPException(400, "Invalid image or metadata")
    return {
        "filename": file.filename,
        "metadata": metadata,
        "has_gps": metadata["gps_lat"] is not None and metadata["gps_lng"] is not None,
        "has_capture_time": metadata["capture_time"] is not None
    }


def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two GPS points in kilometres."""
    radius = 6371.0088
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    a = min(1.0, max(0.0, a))
    return round(2 * radius * math.asin(math.sqrt(a)), 2)


@app.post("/location-check")
async def location_check(
    file: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...)
):
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise HTTPException(400, "Invalid reported coordinates")
    data = await file.read(MAX_IMAGE_SIZE + 1)
    if not data or len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image must be under 10 MB")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        metadata = extract_metadata(image)
    except (UnidentifiedImageError, OSError, ValueError, TypeError):
        raise HTTPException(400, "Invalid image or metadata")

    photo_lat = metadata["gps_lat"]
    photo_lng = metadata["gps_lng"]
    if photo_lat is None or photo_lng is None:
        return {
            "status": "Insufficient Evidence",
            "reason": "No embedded GPS coordinates found",
            "distance_km": None,
            "photo_gps": None,
            "reported_gps": {"lat": lat, "lng": lng}
        }

    distance = haversine_distance(lat, lng, photo_lat, photo_lng)
    status = "Location Consistent" if distance <= 10 else "Location Mismatch"
    return {
        "status": status,
        "reason": (
            "Photo GPS is within 10 km of reported coordinates"
            if distance <= 10
            else "Photo GPS is more than 10 km from reported coordinates"
        ),
        "distance_km": distance,
        "photo_gps": {"lat": photo_lat, "lng": photo_lng},
        "reported_gps": {"lat": lat, "lng": lng}
    }

@app.post("/ai-analyze")
async def ai_analyze(
    file: UploadFile = File(...),
    disaster_type: str = Form(...),
    description: str = Form(...)
):
    data = await file.read(MAX_IMAGE_SIZE + 1)

    if not data or len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Image must be under 10 MB"
        )

    try:
        image = Image.open(io.BytesIO(data))
        image.load()

        if image.format not in ("JPEG", "PNG"):
            raise HTTPException(
                status_code=400,
                detail="Only JPEG and PNG images are supported"
            )

        mime_type = (
            "image/jpeg"
            if image.format == "JPEG"
            else "image/png"
        )

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )

    if not disaster_type.strip() or not description.strip():
        raise HTTPException(
            status_code=400,
            detail="Disaster type and description are required"
        )

    try:
        result = analyze_disaster_image(
            image_bytes=data,
            mime_type=mime_type,
            disaster_type=disaster_type,
            description=description
        )

        return result

    except Exception as error:
        print("Gemini analysis failed:", type(error).__name__)
        raise HTTPException(
            status_code=502,
            detail="AI analysis is temporarily unavailable"
        )
