from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime, timedelta
import httpx, json, os, re
from app.database import get_db
from app.models.models import User, Item, Booking, GroupMember, BookingStatus
from app.dependencies import get_current_user, check_rate_limit
from app.mail import mail_new_booking

router = APIRouter()

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
APP_URL      = os.getenv("APP_URL",      "https://lendapp.haasenheim.com")
BUFFER_DAYS  = 1
MAX_MESSAGE_LEN = 500  # Prompt Injection Schutz


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    group_id: int
    history: Optional[List[Message]] = []

    @field_validator("message")
    @classmethod
    def sanitize_message(cls, v):
        if len(v) > MAX_MESSAGE_LEN:
            raise ValueError("Nachricht zu lang (max. " + str(MAX_MESSAGE_LEN) + " Zeichen)")
        # Prompt Injection Muster entfernen
        dangerous = [
            "ignore previous", "ignore all", "disregard",
            "system prompt", "new instructions", "forget everything",
            "act as", "you are now", "jailbreak",
        ]
        v_lower = v.lower()
        for pattern in dangerous:
            if pattern in v_lower:
                raise ValueError("Ungueltige Nachricht")
        return v


def _check_membership(user_id: int, group_id: int, db: Session):
    if not db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first():
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")


def fmt(dt):
    return dt.strftime("%d.%m.%Y") if dt else "offen"


def _get_visible_items(user: User, group_id: int, db: Session):
    return db.query(Item).filter(
        Item.group_id == group_id,
        Item.deleted_at == None,
        Item.owner_id != user.id,
    ).all()


def _build_context(user: User, group_id: int, db: Session) -> str:
    _check_membership(user.id, group_id, db)
    items = _get_visible_items(user, group_id, db)
    lines = []
    for item in items:
        owner = db.query(User).filter(User.id == item.owner_id).first()
        owner_name = owner.name if owner else "unbekannt"
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
            else:
                status = "nicht verfuegbar"
        line = "- " + item.name + " (Kategorie: " + item.category + ", Besitzer: " + owner_name + ", Status: " + status + ") [intern_id=" + str(item.id) + "]"
        lines.append(line)

    today = datetime.now().strftime("%d.%m.%Y")
    items_block = "\n".join(lines) if lines else "Keine Gegenstaende."

    return (
        "Du bist der freundliche Assistent von Lendapp.\n"
        "Eingeloggter Nutzer: " + user.name + "\n"
        "Heute: " + today + "\n\n"
        "Ausleihbare Gegenstaende (nur diese kennst du, NUR von anderen Personen):\n"
        + items_block + "\n\n"
        "REGELN:\n"
        "1. Erwaehne NIEMALS interne IDs in Antworten.\n"
        "2. Erwaehne NIE Gegenstaende des Nutzers selbst.\n"
        "3. Links zu Gegenstaenden im Format: [Name](ITEM_LINK:intern_id)\n"
        "4. Antworte auf Deutsch, freundlich, kurz.\n"
        "5. Zeige nie Daten ausserhalb dieser Liste.\n\n"
        "Fuer Aktionen antworte NUR mit JSON:\n"
        '{"action": "CREATE_BOOKING", "item_id": 5, "date_from": "2026-06-01", "date_to": "2026-06-07", "note": ""}\n'
        '{"action": "CANCEL_BOOKING", "booking_id": 3}'
    )


def _execute_action(action_data: dict, user: User, group_id: int, db: Session) -> str:
    action = action_data.get("action")

    if action == "CREATE_BOOKING":
        item_id = action_data.get("item_id")
        # Sicherstellen dass item_id ein Integer ist
        try:
            item_id = int(item_id)
        except (TypeError, ValueError):
            return "Ungueltiger Artikel."
        item = db.query(Item).filter(
            Item.id == item_id, Item.deleted_at == None, Item.group_id == group_id
        ).first()
        if not item:
            return "Diesen Gegenstand konnte ich nicht finden."
        if item.owner_id == user.id:
            return "Das ist dein eigener Gegenstand."
        try:
            date_from = datetime.strptime(str(action_data["date_from"])[:10], "%Y-%m-%d")
            date_to   = datetime.strptime(str(action_data["date_to"])[:10],   "%Y-%m-%d")
        except Exception:
            return "Das Datum konnte nicht verarbeitet werden."

        from app.routers.bookings import _check_overlap
        overlap = _check_overlap(db, item_id, date_from, date_to)
        if overlap:
            next_free = (overlap.date_to + timedelta(days=BUFFER_DAYS)) if overlap.date_to else None
            msg = item.name + " ist in diesem Zeitraum vergeben."
            if next_free:
                msg += " Fruehestens ab " + fmt(next_free) + "."
            return msg

        # Notiz bereinigen
        note = str(action_data.get("note") or "KI-Buchung")[:200]

        booking = Booking(
            item_id=item_id, borrower_id=user.id,
            date_from=date_from, date_to=date_to,
            note=note, status=BookingStatus.pending,
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
        return "Buchungsanfrage fuer " + item.name + " (" + fmt(date_from) + " - " + fmt(date_to) + ") gesendet! " + owner_name + " muss noch bestaetigen."

    elif action == "CANCEL_BOOKING":
        try:
            booking_id = int(action_data.get("booking_id"))
        except (TypeError, ValueError):
            return "Ungueltige Buchungs-ID."
        booking = db.query(Booking).filter(
            Booking.id == booking_id,
            Booking.borrower_id == user.id,  # Nur eigene Buchungen
            Booking.status == BookingStatus.pending,
        ).first()
        if not booking:
            return "Buchung nicht gefunden oder kann nicht storniert werden."
        booking.status = BookingStatus.rejected
        db.commit()
        return "Buchungsanfrage wurde storniert."

    return "Unbekannte Aktion."


def _resolve_links(text: str, user: User, group_id: int, db: Session) -> str:
    visible_ids = {i.id for i in _get_visible_items(user, group_id, db)}

    def replace(match):
        label = match.group(1)[:100]  # Label laenge begrenzen
        try:
            item_id = int(match.group(2))
        except Exception:
            return label
        if item_id in visible_ids:
            return "[" + label + "](" + APP_URL + "/items/" + str(item_id) + ")"
        return label

    text = re.sub(r"\[([^\]]+)\]\(ITEM_LINK:(\d+)\)", replace, text)
    text = re.sub(r"\s*\[?intern_id=\d+\]?", "", text)
    return text


@router.post("/chat")
async def chat(
    data: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_rate_limit(request, "ai")
    context = _build_context(current_user, data.group_id, db)
    messages = [{"role": "system", "content": context}]
    # History begrenzen und bereinigen
    for m in (data.history or [])[-10:]:
        if m.role in ("user", "assistant") and len(m.content) <= MAX_MESSAGE_LEN:
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": data.message})

    payload = {"model": OLLAMA_MODEL, "messages": messages, "stream": False}
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

            answer = _resolve_links(answer, current_user, data.group_id, db)
            return {"answer": answer, "model": OLLAMA_MODEL, "action_taken": False}

    except httpx.ConnectError:
        raise HTTPException(503, "Ollama nicht erreichbar")
    except Exception:
        raise HTTPException(500, "AI momentan nicht verfuegbar")


@router.get("/status")
async def ai_status(current_user: User = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res    = await client.get(OLLAMA_URL + "/api/tags")
            models = [m["name"] for m in res.json().get("models", [])]
            avail  = any(OLLAMA_MODEL.split(":")[0] in m for m in models)
            return {"ollama": "online", "model": OLLAMA_MODEL, "model_available": avail}
    except Exception:
        return {"ollama": "offline", "model": OLLAMA_MODEL, "model_available": False}
