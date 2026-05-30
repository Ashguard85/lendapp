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

BUFFER_DAYS = 1


def _get_item_or_404(db, item_id):
    item = db.query(Item).filter(Item.id == item_id, Item.deleted_at == None).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    return item


def fmt_date(dt):
    if not dt:
        return "offen"
    return dt.strftime("%d.%m.%Y")


def booking_with_names(b: Booking, db: Session):
    borrower = db.query(User).filter(User.id == b.borrower_id).first() if b.borrower_id else None
    item     = db.query(Item).filter(Item.id == b.item_id).first()
    owner    = db.query(User).filter(User.id == item.owner_id).first() if item else None
    display  = b.external_name if b.external_name else (borrower.name if borrower else "User #" + str(b.borrower_id))
    return {
        "id":            b.id,
        "item_id":       b.item_id,
        "item_name":     item.name if item else "Item #" + str(b.item_id),
        "borrower_id":   b.borrower_id,
        "borrower_name": display,
        "external_name": b.external_name,
        "owner_id":      item.owner_id if item else None,
        "owner_name":    owner.name if owner else None,
        "date_from":     b.date_from,
        "date_to":       b.date_to,
        "status":        b.status,
        "note":          b.note,
        "created_at":    b.created_at,
    }


def _naive(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _check_overlap(db, item_id: int, date_from: datetime, date_to: datetime, exclude_id: int = None):
    if not date_to:
        return None

    df = _naive(date_from)
    dt = _naive(date_to)

    q = db.query(Booking).filter(
        Booking.item_id == item_id,
        Booking.status.in_([BookingStatus.approved, BookingStatus.external]),
    )
    if exclude_id:
        q = q.filter(Booking.id != exclude_id)

    for b in q.all():
        b_from = _naive(b.date_from) - timedelta(days=BUFFER_DAYS)
        b_to   = (_naive(b.date_to) + timedelta(days=BUFFER_DAYS)) if b.date_to else None

        if b_to is None:
            if dt > b_from:
                return b
        else:
            if df < b_to and dt > b_from:
                return b
    return None


def _update_availability(item: Item, db: Session):
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


def _send_new_booking_mail(booking: Booking, item: Item, db: Session):
    owner    = db.query(User).filter(User.id == item.owner_id).first()
    borrower = db.query(User).filter(User.id == booking.borrower_id).first() if booking.borrower_id else None
    if owner and borrower:
        mail_new_booking(
            owner_email=owner.email,
            owner_name=owner.name,
            borrower_name=borrower.name,
            item_name=item.name,
            date_from=fmt_date(booking.date_from),
            date_to=fmt_date(booking.date_to),
            note=booking.note or "",
        )


@router.post("/", status_code=201)
def request_booking(data: BookingCreate, user_id: int, db: Session = Depends(get_db)):
    item        = _get_item_or_404(db, data.item_id)
    is_external = bool(data.external_name)
    is_owner    = item.owner_id == user_id

    if is_external and not is_owner:
        raise HTTPException(403, "Nur der Besitzer kann externe Ausleihen erfassen")
    if data.date_to and data.date_from >= data.date_to:
        raise HTTPException(400, "Enddatum muss nach Startdatum liegen")

    if not is_external and data.date_to:
        days = (_naive(data.date_to) - _naive(data.date_from)).days
        if days > item.max_days:
            raise HTTPException(400, "Maximale Ausleihzeit: " + str(item.max_days) + " Tage")

    if data.date_to:
        overlap = _check_overlap(db, data.item_id, data.date_from, data.date_to)
        if overlap:
            next_free = (overlap.date_to + timedelta(days=BUFFER_DAYS)) if overlap.date_to else None
            msg = "Zeitraum bereits vergeben."
            if next_free:
                msg += " Fruehestens buchbar ab " + fmt_date(next_free) + "."
            raise HTTPException(409, msg)

    status      = BookingStatus.external if is_external else BookingStatus.pending
    borrower_id = None if is_external else user_id

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

    if not is_external:
        _send_new_booking_mail(booking, item, db)

    return booking_with_names(booking, db)


@router.get("/item/{item_id}")
def bookings_for_item(item_id: int, db: Session = Depends(get_db)):
    return [booking_with_names(b, db) for b in db.query(Booking).filter(Booking.item_id == item_id).all()]


@router.get("/user/{user_id}")
def bookings_for_user(user_id: int, db: Session = Depends(get_db)):
    return [booking_with_names(b, db) for b in db.query(Booking).filter(Booking.borrower_id == user_id).all()]


@router.get("/pending/owner/{owner_id}")
def pending_for_owner(owner_id: int, db: Session = Depends(get_db)):
    items    = db.query(Item).filter(Item.owner_id == owner_id, Item.deleted_at == None).all()
    item_ids = [i.id for i in items]
    if not item_ids:
        return []
    bookings = db.query(Booking).filter(
        Booking.item_id.in_(item_ids),
        Booking.status == BookingStatus.pending,
    ).all()
    return [booking_with_names(b, db) for b in bookings]


@router.patch("/{booking_id}/status")
def update_status(booking_id: int, data: BookingStatusUpdate, user_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(404, "Buchung nicht gefunden")
    item = _get_item_or_404(db, booking.item_id)
    if item.owner_id != user_id:
        raise HTTPException(403, "Nur der Besitzer darf den Status aendern")

    booking.status = data.status
    db.flush()

    if data.status in [BookingStatus.approved, BookingStatus.external]:
        item.is_available = False
    elif data.status in [BookingStatus.returned, BookingStatus.rejected]:
        _update_availability(item, db)

    db.commit()
    db.refresh(booking)

    owner    = db.query(User).filter(User.id == item.owner_id).first()
    borrower = db.query(User).filter(User.id == booking.borrower_id).first() if booking.borrower_id else None

    if borrower:
        if data.status == BookingStatus.approved:
            date_to_str = fmt_date(booking.date_to) if booking.date_to else "kein Enddatum"
            mail_booking_approved(
                borrower_email=borrower.email,
                borrower_name=borrower.name,
                item_name=item.name,
                owner_name=owner.name if owner else "",
                date_from=fmt_date(booking.date_from),
                date_to=date_to_str,
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
    tomorrow_start = datetime.utcnow().replace(hour=0, minute=0, second=0) + timedelta(days=1)
    tomorrow_end   = tomorrow_start + timedelta(days=1)

    bookings = db.query(Booking).filter(
        Booking.status == BookingStatus.approved,
        Booking.date_to >= tomorrow_start,
        Booking.date_to < tomorrow_end,
    ).all()

    sent = 0
    for b in bookings:
        borrower = db.query(User).filter(User.id == b.borrower_id).first() if b.borrower_id else None
        item     = db.query(Item).filter(Item.id == b.item_id).first()
        owner    = db.query(User).filter(User.id == item.owner_id).first() if item else None
        if borrower and item and owner:
            mail_return_reminder(
                borrower_email=borrower.email,
                borrower_name=borrower.name,
                item_name=item.name,
                owner_name=owner.name,
                date_to=fmt_date(b.date_to),
            )
            sent += 1

    expired = db.query(Booking).filter(
        Booking.status.in_([BookingStatus.approved, BookingStatus.external]),
        Booking.date_to < datetime.utcnow(),
    ).all()
    for b in expired:
        item = db.query(Item).filter(Item.id == b.item_id).first()
        if item:
            _update_availability(item, db)
    db.commit()

    return {"reminders_sent": sent, "availability_updated": len(expired)}
