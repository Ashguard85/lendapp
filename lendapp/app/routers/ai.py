from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import httpx, json, os
from app.database import get_db
from app.models.models import User, Item, Booking, GroupMember, BookingStatus
from app.dependencies import get_current_user
from app.mail import mail_new_booking

router = APIRouter()

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
BUFFER_DAYS  = 1


class ChatRequest(BaseModel):
    message: str
    group_id: int


def _get_group_items(user: User, group_id: int, db: Session):
    membership = db.query(GroupMember).filter_by(group_id=group_id, user_id=user.id).first()
    if not membership:
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")
    return db.query(Item).filter(Item.group_id == group_id, Item.deleted_at == None).all()


def fmt(dt):
    return dt.strftime("%d.%m.%Y") if dt else "offen"


def _build_context(user: User, group_id: int, db: Session) -> str:
    items = _get_group_items(user, group_id, db)
    lines = []
    for item in items:
        owner = db.query(User).filter(User.id == item.owner_id).first()
        owner_name = owner.name if owner else "Unbekannt"
        is_mine = item.owner_id == user.id
        if item.is_available:
            status = "verfuegbar"
        else:
            active = db.query(Booking).filter(
                Booking.item_id == item.id,
                Booking.status.in_([BookingStatus.approved, BookingStatus.external])
            ).first()
            if active and active.date_to:
                next_free = active.date_to + timedelta(days=BUFFER_DAYS)
                status = "ausgeliehen bis " + fmt(active.date_to) + ", buchbar ab " + fmt(next_free)
                if active.borrower_id:
                    b = db.query(User).filter(User.id == active.borrower_id).first()
                    if b:
                        status += " (bei " + b.name + ")"
                elif active.external_name:
                    status += " (bei " + active.external_name + ")"
            else:
                status = "ausgeliehen (offen)"
        mine = " [DEIN ARTIKEL]" if is_mine else " [Besitzer: " + owner_name + "]"
        lines.append("- ID:" + str(item.id) + " | " + item.name + " | " + item.category + " | " + status + mine)

    today = datetime.now().strftime("%d.%m.%Y")
    items_text = "\n".join(lines) if lines else "Keine Gegenstaende."

    return (
        "Du bist ein intelligenter Assistent fuer Lendapp.\n"
        "Eingeloggter User: " + user.name + " (ID: " + str(user.id) + ")\n"
        "Heute: " + today + "\n\n"
        "Gegenstaende in der Gruppe (NUR diese kennst du):\n"
        + items_text + "\n\n"
        "Du kannst folgende Aktionen ausfuehren wenn der User es wuenscht:\n"
        "- CREATE_BOOKING: Buchungsanfrage erstellen\n"
        "- CANCEL_BOOKING: Eigene ausstehende Buchung stornieren\n\n"
        "Wenn eine Aktion gewuenscht ist, antworte NUR mit JSON:\n"
        '{"action": "CREATE_BOOKING", "item_id": 1, "date_from": "2026-06-01", "date_to": "2026-06-07", "note": ""}\n'
        '{"action": "CANCEL_BOOKING", "booking_id": 5}\n\n'
        "Sonst antworte normal auf Deutsch, freundlich und kurz.\n"
        "Zeige nie Daten ausserhalb dieser Gruppe."
    )


def _execute_action(action_data: dict, user: User, group_id: int, db: Session) -> str:
    action = action_data.get("action")

    if action == "CREATE_BOOKING":
        item_id = action_data.get("item_id")
        item = db.query(Item).filter(
            Item.id == item_id, Item.deleted_at == None, Item.group_id == group_id
        ).first()
        if not item:
            return "Artikel nicht gefunden."
        if item.owner_id == user.id:
            return "Du kannst deinen eigenen Artikel nicht buchen."
        try:
            date_from = datetime.strptime(action_data["date_from"], "%Y-%m-%d")
            date_to   = datetime.strptime(action_data["date_to"],   "%Y-%m-%d")
        except Exception:
            return "Ungültiges Datum."

        from app.routers.bookings import _check_overlap
        overlap = _check_overlap(db, item_id, date_from, date_to)
        if overlap:
            next_free = (overlap.date_to + timedelta(days=BUFFER_DAYS)) if overlap.date_to else None
            msg = item.name + " ist in diesem Zeitraum vergeben."
            if next_free:
                msg += " Fruehestens ab " + fmt(next_free) + "."
            return msg

        booking = Booking(
            item_id=item_id, borrower_id=user.id,
            date_from=date_from, date_to=date_to,
            note=action_data.get("note") or "KI-Buchung",
            status=BookingStatus.pending,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)

        owner = db.query(User).filter(User.id == item.owner_id).first()
        if owner:
            mail_new_booking(
                owner_email=owner.email, owner_name=owner.name,
                borrower_name=user.name, item_name=item.name,
                date_from=fmt(date_from), date_to=fmt(date_to),
                note=booking.note,
            )
        owner_name = owner.name if owner else "Der Besitzer"
        return ("Buchungsanfrage fuer " + item.name + " (" + fmt(date_from) + " - " + fmt(date_to) +
                ") gesendet! " + owner_name + " muss noch bestaetigen.")

    elif action == "CANCEL_BOOKING":
        booking_id = action_data.get("booking_id")
        booking = db.query(Booking).filter(
            Booking.id == booking_id,
            Booking.borrower_id == user.id,
            Booking.status == BookingStatus.pending,
        ).first()
        if not booking:
            return "Buchung nicht gefunden oder kann nicht storniert werden."
        booking.status = BookingStatus.rejected
        db.commit()
        return "Buchungsanfrage wurde storniert."

    return "Unbekannte Aktion."


@router.post("/chat")
async def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    context = _build_context(current_user, data.group_id, db)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": context},
            {"role": "user",   "content": data.message},
        ],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            res = await client.post(OLLAMA_URL + "/api/chat", json=payload)
            res.raise_for_status()
            answer = res.json()["message"]["content"].strip()

            if answer.startswith("{") and "action" in answer:
                try:
                    action_data = json.loads(answer)
                    result = _execute_action(action_data, current_user, data.group_id, db)
                    return {"answer": result, "model": OLLAMA_MODEL, "action_taken": True}
                except json.JSONDecodeError:
                    pass

            return {"answer": answer, "model": OLLAMA_MODEL, "action_taken": False}

    except httpx.ConnectError:
        raise HTTPException(503, "Ollama nicht erreichbar")
    except Exception as e:
        raise HTTPException(500, "AI-Fehler: " + str(e))


@router.get("/status")
async def ai_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res    = await client.get(OLLAMA_URL + "/api/tags")
            models = [m["name"] for m in res.json().get("models", [])]
            avail  = any(OLLAMA_MODEL.split(":")[0] in m for m in models)
            return {"ollama": "online", "model": OLLAMA_MODEL, "model_available": avail}
    except Exception:
        return {"ollama": "offline", "model": OLLAMA_MODEL, "model_available": False}
