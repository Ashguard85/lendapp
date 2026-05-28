from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import httpx, json, os
from app.database import get_db
from app.models.models import User, Item, Booking, GroupMember, BookingStatus
from app.dependencies import get_current_user
from app.mail import mail_new_booking

router = APIRouter()

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
APP_URL      = os.getenv("APP_URL",      "https://lendapp.haasenheim.com")
BUFFER_DAYS  = 1


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    group_id: int
    history: Optional[List[Message]] = []


def _check_membership(user_id: int, group_id: int, db: Session):
    if not db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first():
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")


def fmt(dt):
    return dt.strftime("%d.%m.%Y") if dt else "offen"


def _get_visible_items(user: User, group_id: int, db: Session):
    """Nur fremde Gegenstände (nicht die eigenen)."""
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
        if item.is_available:
            status = "verfügbar"
        else:
            active = db.query(Booking).filter(
                Booking.item_id == item.id,
                Booking.status.in_([BookingStatus.approved, BookingStatus.external])
            ).first()
            if active and active.date_to:
                next_free = active.date_to + timedelta(days=BUFFER_DAYS)
                status = f"ausgeliehen bis {fmt(active.date_to)}, wieder buchbar ab {fmt(next_free)}"
            else:
                status = "aktuell nicht verfügbar"
        # Interne ID nur für Tool-Calls, NICHT in Antworten
        lines.append(f'- "{item.name}" (Kategorie: {item.category}, Besitzer: {owner.name if owner else "?"}, Status: {status}) [intern_id={item.id}]')

    today = datetime.now().strftime("%d.%m.%Y")
    items_block = "\n".join(lines) if lines else "Aktuell keine ausleihbaren Gegenstände von anderen."

    return f"""Du bist der freundliche Assistent von Lendapp, einer App zum Ausleihen von Gegenständen unter Freunden und Familie.

Eingeloggter Nutzer: {user.name}
Heutiges Datum: {today}

Ausleihbare Gegenstände (nur diese kennst du, NUR von anderen Personen):
{items_block}

WICHTIGE REGELN:
1. Erwähne NIEMALS interne IDs (intern_id) in deinen Antworten. Diese sind nur für dich.
2. Erwähne NIE Gegenstände die dem Nutzer selbst gehören.
3. Wenn du einen Gegenstand empfiehlst, biете einen Link an im Format: [Gegenstandsname](ITEM_LINK:intern_id)
   Beispiel: "Schau dir die [Bohrmaschine](ITEM_LINK:5) an."
   Das System wandelt das automatisch in einen echten Link um.
4. Antworte auf Deutsch, freundlich, kurz und natürlich.
5. Zeige nie Daten ausserhalb dieser Liste.

Für Aktionen antworte NUR mit JSON:
{{"action": "CREATE_BOOKING", "item_id": 5, "date_from": "2026-06-01", "date_to": "2026-06-07", "note": ""}}
{{"action": "CANCEL_BOOKING", "booking_id": 3}}"""


def _execute_action(action_data: dict, user: User, group_id: int, db: Session) -> str:
    action = action_data.get("action")

    if action == "CREATE_BOOKING":
        item_id = action_data.get("item_id")
        item = db.query(Item).filter(
            Item.id == item_id, Item.deleted_at == None, Item.group_id == group_id
        ).first()
        if not item:
            return "Diesen Gegenstand konnte ich leider nicht finden."
        if item.owner_id == user.id:
            return "Das ist dein eigener Gegenstand – den musst du nicht ausleihen 😊"
        try:
            date_from = datetime.strptime(action_data["date_from"], "%Y-%m-%d")
            date_to   = datetime.strptime(action_data["date_to"],   "%Y-%m-%d")
        except:
            return "Das Datum habe ich nicht verstanden. Kannst du es nochmal nennen?"

        from app.routers.bookings import _check_overlap
        overlap = _check_overlap(db, item_id, date_from, date_to)
        if overlap:
            next_free = (overlap.date_to + timedelta(days=BUFFER_DAYS)) if overlap.date_to else None
            msg = f"„{item.name}" ist in diesem Zeitraum leider schon vergeben."
            if next_free:
                msg += f" Frühestens wieder ab {fmt(next_free)}."
            return msg

        booking = Booking(
            item_id=item_id, borrower_id=user.id,
            date_from=date_from, date_to=date_to,
            note=action_data.get("note") or "Buchung über Assistent",
            status=BookingStatus.pending,
        )
        db.add(booking); db.commit(); db.refresh(booking)

        owner = db.query(User).filter(User.id == item.owner_id).first()
        if owner:
            mail_new_booking(
                owner_email=owner.email, owner_name=owner.name,
                borrower_name=user.name, item_name=item.name,
                date_from=fmt(date_from), date_to=fmt(date_to),
                note=booking.note,
            )
        return f"✅ Deine Anfrage für „{item.name}" ({fmt(date_from)} – {fmt(date_to)}) ist raus! {owner.name if owner else 'Der Besitzer'} bekommt eine Benachrichtigung."

    elif action == "CANCEL_BOOKING":
        booking_id = action_data.get("booking_id")
        booking = db.query(Booking).filter(
            Booking.id == booking_id, Booking.borrower_id == user.id,
            Booking.status == BookingStatus.pending,
        ).first()
        if not booking:
            return "Diese Buchung konnte ich nicht finden oder sie lässt sich nicht mehr stornieren."
        booking.status = BookingStatus.rejected
        db.commit()
        return "✅ Deine Anfrage wurde storniert."

    return "Diese Aktion kenne ich leider nicht."


def _resolve_links(text: str, user: User, group_id: int, db: Session) -> str:
    """
    Wandelt ITEM_LINK:id in echte, geprüfte Links um.
    Nur gültige, sichtbare (fremde) Gegenstände werden verlinkt.
    Ungültige Links werden entfernt.
    """
    import re

    visible_ids = {i.id for i in _get_visible_items(user, group_id, db)}

    def replace(match):
        label = match.group(1)
        try:
            item_id = int(match.group(2))
        except:
            return label
        # Link nur wenn Gegenstand existiert UND sichtbar ist
        if item_id in visible_ids:
            return f"[{label}]({APP_URL}/items/{item_id})"
        # Ungültig → nur Label ohne Link
        return label

    # Pattern: [Label](ITEM_LINK:123)
    text = re.sub(r'\[([^\]]+)\]\(ITEM_LINK:(\d+)\)', replace, text)
    # Falls Modell rohe intern_id Erwähnungen einbaut – entfernen
    text = re.sub(r'\s*\[?intern_id=\d+\]?', '', text)
    return text


@router.post("/chat")
async def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    context = _build_context(current_user, data.group_id, db)

    # Gesprächsverlauf aufbauen
    messages = [{"role": "system", "content": context}]
    for m in (data.history or [])[-10:]:  # letzte 10 Nachrichten
        if m.role in ("user", "assistant"):
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": data.message})

    payload = {"model": OLLAMA_MODEL, "messages": messages, "stream": False}

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            res = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            res.raise_for_status()
            answer = res.json()["message"]["content"].strip()

            # Aktion?
            if answer.startswith("{") and "action" in answer:
                try:
                    action_data = json.loads(answer)
                    result = _execute_action(action_data, current_user, data.group_id, db)
                    return {"answer": result, "model": OLLAMA_MODEL, "action_taken": True}
                except json.JSONDecodeError:
                    pass

            # Links auflösen und prüfen
            answer = _resolve_links(answer, current_user, data.group_id, db)
            return {"answer": answer, "model": OLLAMA_MODEL, "action_taken": False}

    except httpx.ConnectError:
        raise HTTPException(503, "Ollama nicht erreichbar")
    except Exception as e:
        raise HTTPException(500, f"AI-Fehler: {str(e)}")


@router.get("/status")
async def ai_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res    = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in res.json().get("models", [])]
            avail  = any(OLLAMA_MODEL.split(":")[0] in m for m in models)
            return {"ollama": "online", "model": OLLAMA_MODEL, "model_available": avail}
    except:
        return {"ollama": "offline", "model": OLLAMA_MODEL, "model_available": False}
