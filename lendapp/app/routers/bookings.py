from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models.models import Booking, Item, User, BookingStatus
from app.schemas.schemas import BookingCreate, BookingStatusUpdate
from app.mail import (
    mail_new_booking, mail_booking_approved,
    mail_booking_rejected, mail_return_reminder
)

router = APIRouter()


def _get_item_or_404(db, item_id):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    return item


def fmt_date(dt):
    if not dt:
        return "offen"
    return dt.strftime("%d.%m.%Y")


def booking_with_names(b: Booking, db: Session):
    borrower = db.query(User).filter(User.id == b.borrower_id).first() if b.borrower_id else None
    item = db.query(Item).filter(Item.id == b.item_id).first()
    owner = db.query(User).filter(User.id == item.owner_id).first() if item else None
    display_name = b.external_name if b.external_name else (borrower.name if borrower else f"User #{b.borrower_id}")
    return {
        "id": b.id,
        "item_id": b.item_id,
        "item_name": item.name if item else f"Item #{b.item_id}",
        "borrower_id": b.borrower_id,
        "borrower_name": display_name,
        "external_name": b.external_name,
        "owner_id": item.owner_id if item else None,
        "owner_name": owner.name if owner else None,
        "date_from": b.date_from,
        "date_to": b.date_to,
        "status": b.status,
        "note": b.note,
        "created_at": b.created_at,
    }


def _update_availability(item: Item, db: Session):
    """
    Prüft ob das Item ab morgen wieder verfügbar ist.
    Verfügbar wenn keine aktive Buchung (approved/external) mehr läuft.
    """
    tomorrow = datetime.utcnow() + timedelta(days=1)
    active = (
        db.query(Booking)
        .filter(
            Booking.item_id == item.id,
            Booking.status.in_([BookingStatus.approved, BookingStatus.external]),
            (Booking.date_to == None) | (Booking.date_to >= tomorrow),
        ).first()
    )
    item.is_available = active is None


@router.post("/", status_code=201)
def request_booking(data: BookingCreate, user_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(db, data.item_id)
    is_external = bool(data.external_name)
    is_owner = item.owner_id == user_id

    if is_external and not is_owner:
        raise HTTPException(403, "Nur der Besitzer kann externe Ausleihen erfassen")
    if data.date_to and data.date_from >= data.date_to:
        raise HTTPException(400, "Enddatum muss nach Startdatum liegen")

    # Max-Tage nur bei normalen Buchungen prüfen, nicht bei extern/eigenbedarf
    if not is_external and data.date_to:
        days = (data.date_to - data.date_from).days
        if days > item.max_days:
            raise HTTPException(400, f"Maximale Ausleihzeit: {item.max_days} Tage")

    # Überschneidung prüfen – Verfügbar ab 1 Tag nach Rückgabe
    if data.date_to:
        overlap = (
            db.query(Booking)
            .filter(
                Booking.item_id == data.item_id,
                Booking.status.in_([BookingStatus.approved, BookingStatus.external]),
                Booking.date_from < data.date_to,
                (Booking.date_to == None) | (Booking.date_to + timedelta(days=1) > data.date_from),
            ).first()
        )
        if overlap:
            raise HTTPException(409, f"Zeitraum bereits vergeben. Verfügbar ab {fmt_date(overlap.date_to + timedelta(days=1) if overlap.date_to else None)}")

    if is_external:
        status = BookingStatus.external
        borrower_id = None
    else:
        status = BookingStatus.pending
        borrower_id = user_id

    booking = Booking(
        item_id=data.item_id,
        borrower_id=borrower_id,
        external_name=data.external_name,
        date_from=data.date_from,
        date_to=data.date_to,
        note=data.note,
        status=status,
    )
    db.add(booking)

    if is_external:
        item.is_available = False

    db.commit()
    db.refresh(booking)

    # Mail an Besitzer bei neuer Anfrage
    if not is_external:
        owner = db.query(User).filter(User.id == item.owner_id).first()
        borrower = db.query(User).filter(User.id == user_id).first()
        if owner and borrower:
            mail_new_booking(
                owner_email=owner.email,
                owner_name=owner.name,
                borrower_name=borrower.name,
                item_name=item.name,
                date_from=fmt_date(data.date_from),
                date_to=fmt_date(data.date_to),
                note=data.note or "",
            )

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
    items = db.query(Item).filter(Item.owner_id == owner_id).all()
    item_ids = [i.id for i in items]
    if not item_ids:
        return []
    bookings = (
        db.query(Booking)
        .filter(Booking.item_id.in_(item_ids), Booking.status == BookingStatus.pending)
        .all()
    )
    return [booking_with_names(b, db) for b in bookings]


@router.patch("/{booking_id}/status")
def update_status(booking_id: int, data: BookingStatusUpdate, user_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    item = _get_item_or_404(db, booking.item_id)
    if item.owner_id != user_id:
        raise HTTPException(403, "Nur der Besitzer darf den Status ändern")

    booking.status = data.status
    db.flush()

    # Verfügbarkeit neu berechnen
    if data.status in [BookingStatus.approved, BookingStatus.external]:
        item.is_available = False
    elif data.status in [BookingStatus.returned, BookingStatus.rejected]:
        _update_availability(item, db)

    db.commit()
    db.refresh(booking)

    # Mails
    owner = db.query(User).filter(User.id == item.owner_id).first()
    borrower = db.query(User).filter(User.id == booking.borrower_id).first() if booking.borrower_id else None

    if borrower:
        if data.status == BookingStatus.approved:
            mail_booking_approved(
                borrower_email=borrower.email,
                borrower_name=borrower.name,
                item_name=item.name,
                owner_name=owner.name if owner else "",
                date_from=fmt_date(booking.date_from),
                date_to=fmt_date(booking.date_to),
            )
        elif data.status == BookingStatus.rejected:
            mail_booking_rejected(
                borrower_email=borrower.email,
                borrower_name=borrower.name,
                item_name=item.name,
                owner_name=owner.name if owner else "",
            )

    return booking_with_names(booking, db)


@router.post("/reminders")
def send_reminders(db: Session = Depends(get_db)):
    """Täglich aufgerufen – sendet Erinnerungen für morgen ablaufende Buchungen."""
    tomorrow_start = datetime.utcnow().replace(hour=0, minute=0, second=0) + timedelta(days=1)
    tomorrow_end   = tomorrow_start + timedelta(days=1)

    bookings = (
        db.query(Booking)
        .filter(
            Booking.status == BookingStatus.approved,
            Booking.date_to >= tomorrow_start,
            Booking.date_to < tomorrow_end,
        ).all()
    )

    sent = 0
    for b in bookings:
        borrower = db.query(User).filter(User.id == b.borrower_id).first() if b.borrower_id else None
        item = db.query(Item).filter(Item.id == b.item_id).first()
        owner = db.query(User).filter(User.id == item.owner_id).first() if item else None
        if borrower and item and owner:
            mail_return_reminder(
                borrower_email=borrower.email,
                borrower_name=borrower.name,
                item_name=item.name,
                owner_name=owner.name,
                date_to=fmt_date(b.date_to),
            )
            sent += 1

    # Verfügbarkeit automatisch aktualisieren für abgelaufene Buchungen
    expired = (
        db.query(Booking)
        .filter(
            Booking.status.in_([BookingStatus.approved, BookingStatus.external]),
            Booking.date_to < datetime.utcnow(),
        ).all()
    )
    for b in expired:
        item = db.query(Item).filter(Item.id == b.item_id).first()
        if item:
            _update_availability(item, db)
    db.commit()

    return {"reminders_sent": sent, "availability_updated": len(expired)}
