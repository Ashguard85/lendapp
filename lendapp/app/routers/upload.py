import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from PIL import Image
import io

router = APIRouter()

UPLOAD_DIR = "/app/data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Nur JPG, PNG oder WebP erlaubt")
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Bild zu gross (max. 5MB)")
    img = Image.open(io.BytesIO(contents))
    img.thumbnail((800, 800))
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    img.convert("RGB").save(filepath, "JPEG", quality=85)
    return {"url": f"/api/upload/{filename}"}


@router.get("/{filename}")
def get_image(filename: str):
    # Sicherheit: keine Pfad-Traversal
    filename = os.path.basename(filename)
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Bild nicht gefunden")
    return FileResponse(filepath, media_type="image/jpeg")
