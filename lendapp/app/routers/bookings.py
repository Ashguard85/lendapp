from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Booking, Item, BookingStatus
from app.schemas.schemas import BookingCreate, BookingStatusUpdate, BookingOut

router = APIRouter()


def _get_item_or_404(db, item_id):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    return item


@router.post("/", response_model=BookingOut, status_code=201)
def request_booking(data: BookingCreate, user_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(db, data.item_id)
    if not item.is_available:
        raise HTTPException(400, "Gegenstand ist nicht verfügbar")
    if data.date_from >= data.date_to:
        raise HTTPException(400, "Enddatum muss nach Startdatum liegen")
    days = (data.date_to - data.date_from).days
    if days > item.max_days:
        raise HTTPException(400, f"Maximale Ausleihzeit: {item.max_days} Tage")

    # Check for overlapping approved bookings
    overlap = (
        db.query(Booking)
        .filter(
            Booking.item_id == data.item_id,
            Booking.status == BookingStatus.approved,
            Booking.date_from < data.date_to,
            Booking.date_to > data.date_from,
        )
        .first()
    )
    if overlap:
        raise HTTPException(409, "Zeitraum bereits vergeben")

    booking = Booking(**data.model_dump(), borrower_id=user_id)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/item/{item_id}", response_model=List[BookingOut])
def bookings_for_item(item_id: int, db: Session = Depends(get_db)):
    return db.query(Booking).filter(Booking.item_id == item_id).all()


@router.get("/user/{user_id}", response_model=List[BookingOut])
def bookings_for_user(user_id: int, db: Session = Depends(get_db)):
    return db.query(Booking).filter(Booking.borrower_id == user_id).all()


@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_status(
    booking_id: int,
    data: BookingStatusUpdate,
    user_id: int,
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    item = _get_item_or_404(db, booking.item_id)
    if item.owner_id != user_id:
        raise HTTPException(403, "Nur der Besitzer darf den Status ändern")

    booking.status = data.status
    # Mark item unavailable when approved, available again when returned
    if data.status == BookingStatus.approved:
        item.is_available = False
    elif data.status == BookingStatus.returned:
        item.is_available = True
    db.commit()
    db.refresh(booking)
    return booking
