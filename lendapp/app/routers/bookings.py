from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Booking, Item, User, BookingStatus
from app.schemas.schemas import BookingCreate, BookingStatusUpdate, BookingOut

router = APIRouter()


def _get_item_or_404(db, item_id):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    return item


def booking_with_names(b: Booking, db: Session):
    borrower = db.query(User).filter(User.id == b.borrower_id).first()
    item = db.query(Item).filter(Item.id == b.item_id).first()
    owner = db.query(User).filter(User.id == item.owner_id).first() if item else None
    return {
        "id": b.id,
        "item_id": b.item_id,
        "item_name": item.name if item else f"Item #{b.item_id}",
        "borrower_id": b.borrower_id,
        "borrower_name": borrower.name if borrower else f"User #{b.borrower_id}",
        "owner_id": item.owner_id if item else None,
        "owner_name": owner.name if owner else None,
        "date_from": b.date_from,
        "date_to": b.date_to,
        "status": b.status,
        "note": b.note,
        "created_at": b.created_at,
    }


@router.post("/", status_code=201)
def request_booking(data: BookingCreate, user_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(db, data.item_id)
    if not item.is_available:
        raise HTTPException(400, "Gegenstand ist nicht verfügbar")
    if data.date_from >= data.date_to:
        raise HTTPException(400, "Enddatum muss nach Startdatum liegen")
    days = (data.date_to - data.date_from).days
    if days > item.max_days:
        raise HTTPException(400, f"Maximale Ausleihzeit: {item.max_days} Tage")
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
    return booking_with_names(booking, db)


@router.get("/item/{item_id}")
def bookings_for_item(item_id: int, db: Session = Depends(get_db)):
    bookings = db.query(Booking).filter(Booking.item_id == item_id).all()
    return [booking_with_names(b, db) for b in bookings]


@router.get("/user/{user_id}")
def bookings_for_user(user_id: int, db: Session = Depends(get_db)):
    bookings = db.query(Booking).filter(Booking.borrower_id == user_id).all()
    return [booking_with_names(b, db) for b in bookings]


@router.get("/pending/owner/{owner_id}")
def pending_for_owner(owner_id: int, db: Session = Depends(get_db)):
    """Alle offenen Anfragen für Gegenstände die owner_id gehören"""
    items = db.query(Item).filter(Item.owner_id == owner_id).all()
    item_ids = [i.id for i in items]
    if not item_ids:
        return []
    bookings = (
        db.query(Booking)
        .filter(
            Booking.item_id.in_(item_ids),
            Booking.status == BookingStatus.pending,
        )
        .all()
    )
    return [booking_with_names(b, db) for b in bookings]


@router.patch("/{booking_id}/status")
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
    if data.status == BookingStatus.approved:
        item.is_available = False
    elif data.status == BookingStatus.returned:
        item.is_available = True
    db.commit()
    db.refresh(booking)
    return booking_with_names(booking, db)
