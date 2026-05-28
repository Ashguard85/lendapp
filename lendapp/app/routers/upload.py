import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from PIL import Image
import io

router = APIRouter()

UPLOAD_DIR    = "/app/data/uploads"
THUMB_DIR     = "/app/data/thumbs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(THUMB_DIR,  exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE      = 5 * 1024 * 1024


@router.post("/")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Nur JPG, PNG oder WebP erlaubt")
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Bild zu gross (max. 5MB)")

    name = uuid.uuid4().hex

    # Vollbild (max 800px)
    img = Image.open(io.BytesIO(contents))
    img.thumbnail((800, 800))
    full_path = os.path.join(UPLOAD_DIR, f"{name}.jpg")
    img.convert("RGB").save(full_path, "JPEG", quality=85)

    # Thumbnail (200x200 crop)
    thumb = Image.open(io.BytesIO(contents))
    thumb.thumbnail((400, 400))
    w, h = thumb.size
    size = min(w, h)
    left = (w - size) // 2
    top  = (h - size) // 2
    thumb = thumb.crop((left, top, left + size, top + size))
    thumb = thumb.resize((200, 200), Image.LANCZOS)
    thumb_path = os.path.join(THUMB_DIR, f"{name}.jpg")
    thumb.convert("RGB").save(thumb_path, "JPEG", quality=80)

    return {
        "url":       f"/api/upload/{name}.jpg",
        "thumb_url": f"/api/upload/thumb/{name}.jpg",
    }


@router.get("/{filename}")
def get_image(filename: str):
    filename = os.path.basename(filename)
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Bild nicht gefunden")
    return FileResponse(filepath, media_type="image/jpeg")


@router.get("/thumb/{filename}")
def get_thumb(filename: str):
    filename = os.path.basename(filename)
    filepath = os.path.join(THUMB_DIR, filename)
    if not os.path.exists(filepath):
        # Fallback auf Vollbild
        filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Thumbnail nicht gefunden")
    return FileResponse(filepath, media_type="image/jpeg")


@router.delete("/{filename}", status_code=204)
def delete_image(filename: str):
    """Löscht Bild und Thumbnail vom Server."""
    filename = os.path.basename(filename)
    for directory in [UPLOAD_DIR, THUMB_DIR]:
        path = os.path.join(directory, filename)
        if os.path.exists(path):
            os.remove(path)
