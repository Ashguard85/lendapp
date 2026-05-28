from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import httpx
import json
import os
import re

from app.database import get_db
from app.models.models import (
    User,
    Item,
    Booking,
    GroupMember,
    BookingStatus,
)
from app.dependencies import get_current_user

router = APIRouter()

OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")


# =========================
# REQUEST MODELS
# =========================

class ChatMessage(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    message: str
    group_id: int
    history: Optional[List[ChatMessage]] = []


# =========================
# HELPERS
# =========================

def _get_group_items(user: User, group_id: int, db: Session):
    membership = (
        db.query(GroupMember)
        .filter_by(group_id=group_id, user_id=user.id)
        .first()
    )

    if not membership:
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")

    return (
        db.query(Item)
        .filter(
            Item.group_id == group_id,
            Item.deleted_at == None
        )
        .all()
    )


def _get_item_status(item: Item, db: Session):
    """
    Prüft live aktive Buchungen statt nur item.is_available.
    """

    active_booking = (
        db.query(Booking)
        .filter(
            Booking.item_id == item.id,
            Booking.status.in_([
                BookingStatus.approved,
                BookingStatus.external
            ]),
            Booking.date_to >= datetime.now()
        )
        .order_by(Booking.date_to.asc())
        .first()
    )

    if not active_booking:
        return True, "verfügbar"

    if active_booking.borrower_id:
        borrower = (
            db.query(User)
            .filter(User.id == active_booking.borrower_id)
            .first()
        )

        borrower_name = borrower.name if borrower else "Unbekannt"

        return (
            False,
            f"ausgeliehen bis {active_booking.date_to.strftime('%d.%m.%Y')} (bei {borrower_name})"
        )

    if active_booking.external_name:
        return (
            False,
            f"ausgeliehen bis {active_booking.date_to.strftime('%d.%m.%Y')} (bei {active_booking.external_name})"
        )

    return (
        False,
        f"ausgeliehen bis {active_booking.date_to.strftime('%d.%m.%Y')}"
    )


def _build_context(user: User, group_id: int, db: Session) -> str:
    items = _get_group_items(user, group_id, db)

    lines = []

    # Begrenzen damit Context nicht explodiert
    limited_items = items[:120]

    for item in limited_items:
        owner = (
            db.query(User)
            .filter(User.id == item.owner_id)
            .first()
        )

        owner_name = owner.name if owner else "Unbekannt"

        is_available, status = _get_item_status(item, db)

        is_mine = item.owner_id == user.id

        mine = (
            " [DEIN ARTIKEL]"
            if is_mine
            else f" [Besitzer: {owner_name}]"
        )

        lines.append(
            f"- ID:{item.id} | "
            f"{item.name} | "
            f"{item.category} | "
            f"{status}{mine}"
        )

    items_text = "\n".join(lines) if lines else "Keine Gegenstände."

    today = datetime.now().strftime("%d.%m.%Y")

    return f"""
Du bist der KI-Assistent von LendApp.

Heute: {today}

Eingeloggter Benutzer:
- Name: {user.name}
- User-ID: {user.id}

WICHTIGE REGELN:
- Nutze ausschließlich die bereitgestellten Daten.
- Erfinde niemals Gegenstände, Personen oder Buchungen.
- Zeige niemals Daten außerhalb dieser Gruppe.
- Wenn Informationen fehlen, sage das klar.
- Antworte kurz und freundlich.
- Antworten maximal 3 Sätze.
- Nutze Deutsch.
- Nutze keine Markdown-Tabellen.
- Nutze keine erfundenen IDs.

GRUPPEN-GEGENSTÄNDE:
{items_text}

MÖGLICHE AKTIONEN:
1. CREATE_BOOKING
2. CANCEL_BOOKING

WENN EINE AKTION AUSGEFÜHRT WERDEN SOLL:
- Antworte AUSSCHLIESSLICH mit gültigem JSON.
- KEIN Markdown.
- KEIN ```json.
- KEIN zusätzlicher Text.

FORMATE:

{{
  "action": "CREATE_BOOKING",
  "item_id": 1,
  "date_from": "2026-06-01",
  "date_to": "2026-06-07",
  "note": ""
}}

{{
  "action": "CANCEL_BOOKING",
  "booking_id": 5
}}
"""


def _extract_json(text: str):
    """
    Extrahiert robust erstes JSON-Objekt aus AI-Antwort.
    """

    try:
        return json.loads(text)
    except:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        return None

    try:
        return json.loads(match.group())
    except:
        return None


def _execute_action(
    action_data: dict,
    user: User,
    group_id: int,
    db: Session
) -> str:

    action = action_data.get("action")

    # =========================
    # CREATE BOOKING
    # =========================

    if action == "CREATE_BOOKING":

        item_id = action_data.get("item_id")

        item = (
            db.query(Item)
            .filter(
                Item.id == item_id,
                Item.deleted_at == None,
                Item.group_id == group_id,
            )
            .first()
        )

        if not item:
            return "❌ Artikel nicht gefunden."

        if item.owner_id == user.id:
            return "❌ Du kannst deinen eigenen Artikel nicht buchen."

        is_available, _ = _get_item_status(item, db)

        if not is_available:
            return f"❌ {item.name} ist aktuell nicht verfügbar."

        try:
            date_from = datetime.strptime(
                action_data["date_from"],
                "%Y-%m-%d"
            )

            date_to = datetime.strptime(
                action_data["date_to"],
                "%Y-%m-%d"
            )

        except:
            return "❌ Ungültiges Datum."

        if date_to < date_from:
            return "❌ Das Enddatum liegt vor dem Startdatum."

        overlapping = (
            db.query(Booking)
            .filter(
                Booking.item_id == item.id,
                Booking.status.in_([
                    BookingStatus.pending,
                    BookingStatus.approved,
                    BookingStatus.external
                ]),
                Booking.date_from <= date_to,
                Booking.date_to >= date_from
            )
            .first()
        )

        if overlapping:
            return "❌ Für diesen Zeitraum existiert bereits eine Buchung."

        booking = Booking(
            item_id=item.id,
            borrower_id=user.id,
            date_from=date_from,
            date_to=date_to,
            note=action_data.get("note", "KI-Buchung"),
            status=BookingStatus.pending,
        )

        db.add(booking)
        db.commit()

        owner = (
            db.query(User)
            .filter(User.id == item.owner_id)
            .first()
        )

        owner_name = owner.name if owner else "Der Besitzer"

        return (
            f"✅ Buchungsanfrage für {item.name} "
            f"vom {date_from.strftime('%d.%m.%Y')} "
            f"bis {date_to.strftime('%d.%m.%Y')} wurde gesendet. "
            f"{owner_name} muss noch bestätigen."
        )

    # =========================
    # CANCEL BOOKING
    # =========================

    elif action == "CANCEL_BOOKING":

        booking_id = action_data.get("booking_id")

        booking = (
            db.query(Booking)
            .filter(
                Booking.id == booking_id,
                Booking.borrower_id == user.id,
                Booking.status == BookingStatus.pending,
            )
            .first()
        )

        if not booking:
            return "❌ Buchung nicht gefunden oder nicht stornierbar."

        booking.status = BookingStatus.rejected

        db.commit()

        return f"✅ Buchungsanfrage #{booking_id} wurde storniert."

    return "❌ Unbekannte Aktion."


# =========================
# CHAT ENDPOINT
# =========================

@router.post("/chat")
async def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    context = _build_context(
        current_user,
        data.group_id,
        db
    )

    messages = [
        {
            "role": "system",
            "content": context
        }
    ]

    # Conversation Memory
    for msg in data.history[-12:]:

        if msg.role not in ["user", "assistant"]:
            continue

        messages.append({
            "role": msg.role,
            "content": msg.text
        })

    # Aktuelle Nachricht
    messages.append({
        "role": "user",
        "content": data.message
    })

    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }

    try:

        async with httpx.AsyncClient(timeout=90.0) as client:

            res = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload
            )

            res.raise_for_status()

            answer = (
                res.json()["message"]["content"]
                .strip()
            )

            # =========================
            # JSON ACTION PARSING
            # =========================

            action_data = _extract_json(answer)

            if action_data and "action" in action_data:

                result = _execute_action(
                    action_data,
                    current_user,
                    data.group_id,
                    db
                )

                return {
                    "answer": result,
                    "model": OLLAMA_MODEL,
                    "action_taken": True
                }

            return {
                "answer": answer,
                "model": OLLAMA_MODEL,
                "action_taken": False
            }

    except httpx.ConnectError:
        raise HTTPException(
            503,
            "Ollama nicht erreichbar – läuft der Service?"
        )

    except Exception as e:
        raise HTTPException(
            500,
            f"AI-Fehler: {str(e)}"
        )


# =========================
# STATUS
# =========================

@router.get("/status")
async def ai_status():

    try:

        async with httpx.AsyncClient(timeout=5.0) as client:

            res = await client.get(
                f"{OLLAMA_URL}/api/tags"
            )

            models = [
                m["name"]
                for m in res.json().get("models", [])
            ]

            available = any(
                OLLAMA_MODEL.split(":")[0] in m
                for m in models
            )

            return {
                "ollama": "online",
                "model": OLLAMA_MODEL,
                "model_available": available,
                "available_models": models
            }

    except:

        return {
            "ollama": "offline",
            "model": OLLAMA_MODEL,
            "model_available": False
        }
