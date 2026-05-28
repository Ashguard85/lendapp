from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx
import json
import os
from app.database import get_db
from app.models.models import User, Item, Booking, GroupMember, BookingStatus
from app.dependencies import get_current_user

router = APIRouter()

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")


class ChatRequest(BaseModel):
    message: str
    group_id: int


def _get_group_items(user: User, group_id: int, db: Session):
    """Lädt nur Items der Gruppe – Berechtigungsprüfung inklusive."""
    membership = db.query(GroupMember).filter_by(group_id=group_id, user_id=user.id).first()
    if not membership:
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")
    return db.query(Item).filter(Item.group_id == group_id, Item.deleted_at == None).all()


def _build_context(user: User, group_id: int, db: Session) -> str:
    items = _get_group_items(user, group_id, db)
    lines = []
    for item in items:
        owner = db.query(User).filter(User.id == item.owner_id).first()
        owner_name = owner.name if owner else "Unbekannt"
        is_mine = item.owner_id == user.id
        if item.is_available:
            status = "verfügbar"
        else:
            active = db.query(Booking).filter(
                Booking.item_id == item.id,
                Booking.status.in_([BookingStatus.approved, BookingStatus.external])
            ).first()
            if active and active.date_to:
                status = f"ausgeliehen bis {active.date_to.strftime('%d.%m.%Y')}"
                if active.borrower_id:
                    borrower = db.query(User).filter(User.id == active.borrower_id).first()
                    if borrower:
                        status += f" (bei {borrower.name})"
                elif active.external_name:
                    status += f" (bei {active.external_name})"
            else:
                status = "ausgeliehen (offen)"
        mine = " [DEIN ARTIKEL]" if is_mine else f" [Besitzer: {owner_name}]"
        lines.append(f"- ID:{item.id} | {item.name} | {item.category} | {status}{mine}")

    items_text = "\n".join(lines) if lines else "Keine Gegenstände."
    today = datetime.now().strftime("%d.%m.%Y")

    return f"""Du bist ein intelligenter Assistent für LendApp – eine App zum Ausleihen von Gegenständen.
Eingeloggter User: {user.name} (ID: {user.id})
Heute: {today}

Gegenstände in der Gruppe (NUR diese kennst du):
{items_text}

Du kannst folgende Aktionen ausführen wenn der User es wünscht:
- CREATE_BOOKING: Buchungsanfrage erstellen
- CANCEL_BOOKING: Eigene ausstehende Buchung stornieren

Wenn eine Aktion gewünscht ist, antworte NUR mit JSON in diesem Format:
{{"action": "CREATE_BOOKING", "item_id": 1, "date_from": "2026-06-01", "date_to": "2026-06-07", "note": ""}}
{{"action": "CANCEL_BOOKING", "booking_id": 5}}

Sonst antworte normal auf Deutsch, freundlich und kurz.
Zeige nie Daten ausserhalb dieser Gruppe."""


def _execute_action(action_data: dict, user: User, group_id: int, db: Session) -> str:
    """Führt eine vom AI erkannte Aktion aus."""
    action = action_data.get("action")

    if action == "CREATE_BOOKING":
        item_id = action_data.get("item_id")
        item = db.query(Item).filter(
            Item.id == item_id,
            Item.deleted_at == None,
            Item.group_id == group_id,
        ).first()
        if not item:
            return "❌ Artikel nicht gefunden."
        if not item.is_available:
            return f"❌ {item.name} ist gerade nicht verfügbar."
        if item.owner_id == user.id:
            return "❌ Du kannst deinen eigenen Artikel nicht buchen."
        try:
            date_from = datetime.strptime(action_data["date_from"], "%Y-%m-%d")
            date_to   = datetime.strptime(action_data["date_to"],   "%Y-%m-%d")
        except:
            return "❌ Ungültiges Datum. Bitte im Format TT.MM.JJJJ angeben."
        booking = Booking(
            item_id=item_id,
            borrower_id=user.id,
            date_from=date_from,
            date_to=date_to,
            note=action_data.get("note", "KI-Buchung"),
            status=BookingStatus.pending,
        )
        db.add(booking)
        db.commit()
        owner = db.query(User).filter(User.id == item.owner_id).first()
        return f"✅ Buchungsanfrage für **{item.name}** von {date_from.strftime('%d.%m.%Y')} bis {date_to.strftime('%d.%m.%Y')} wurde gesendet! {owner.name} muss noch bestätigen."

    elif action == "CANCEL_BOOKING":
        booking_id = action_data.get("booking_id")
        booking = db.query(Booking).filter(
            Booking.id == booking_id,
            Booking.borrower_id == user.id,
            Booking.status == BookingStatus.pending,
        ).first()
        if not booking:
            return "❌ Buchung nicht gefunden oder kann nicht storniert werden."
        booking.status = BookingStatus.rejected
        db.commit()
        return f"✅ Buchungsanfrage #{booking_id} wurde storniert."

    return "❌ Unbekannte Aktion."


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
            res = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            res.raise_for_status()
            answer = res.json()["message"]["content"].strip()

            # Prüfen ob AI eine Aktion zurückgibt
            if answer.startswith("{") and "action" in answer:
                try:
                    action_data = json.loads(answer)
                    result = _execute_action(action_data, current_user, data.group_id, db)
                    return {"answer": result, "model": OLLAMA_MODEL, "action_taken": True}
                except json.JSONDecodeError:
                    pass

            return {"answer": answer, "model": OLLAMA_MODEL, "action_taken": False}

    except httpx.ConnectError:
        raise HTTPException(503, "Ollama nicht erreichbar – läuft der Service?")
    except Exception as e:
        raise HTTPException(500, f"AI-Fehler: {str(e)}")


@router.get("/status")
async def ai_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in res.json().get("models", [])]
            available = any(OLLAMA_MODEL.split(":")[0] in m for m in models)
            return {"ollama": "online", "model": OLLAMA_MODEL, "model_available": available, "available_models": models}
    except:
        return {"ollama": "offline", "model": OLLAMA_MODEL, "model_available": False}
