from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.models import BookingStatus


# ── User ──────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    class Config: from_attributes = True


# ── Group ─────────────────────────────────────────────
class GroupCreate(BaseModel):
    name: str

class GroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    created_at: datetime
    class Config: from_attributes = True


# ── Item ──────────────────────────────────────────────
class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "Sonstiges"
    image_url: Optional[str] = None
    max_days: Optional[int] = 14
    group_id: int

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    max_days: Optional[int] = None
    is_available: Optional[bool] = None

class ItemOut(BaseModel):
    id: int
    name: str
    description: str
    category: str
    image_url: Optional[str]
    max_days: int
    is_available: bool
    owner_id: int
    group_id: int
    created_at: datetime
    class Config: from_attributes = True


# ── Booking ───────────────────────────────────────────
class BookingCreate(BaseModel):
    item_id: int
    date_from: datetime
    date_to: datetime
    note: Optional[str] = ""

class BookingStatusUpdate(BaseModel):
    status: BookingStatus

class BookingOut(BaseModel):
    id: int
    item_id: int
    borrower_id: int
    date_from: datetime
    date_to: datetime
    status: BookingStatus
    note: str
    created_at: datetime
    class Config: from_attributes = True
