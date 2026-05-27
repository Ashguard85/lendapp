from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx
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


def _build_context(user: User, group_id: int, db: Session) -> str:
    """Lädt nur Daten der Gruppe des Users – nie mehr."""
    # Mitgliedschaft prüfen
    membership = db.query(GroupMember).filter_by(
        group_id=group_id, user_id=user.id
    ).first()
    if not membership:
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")

    # Nur Gegenstände dieser Gruppe
    items = db.query(Item).filter(Item.group_id == group_id).all()

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
                status = "ausgeliehen (kein Enddatum)"

        mine_hint = " [gehört dir]" if is_mine else f" [Besitzer: {owner_name}]"
        lines.append(f"- {item.name} | Kategorie: {item.category} | Status: {status}{mine_hint}")

    items_text = "\n".join(lines) if lines else "Keine Gegenstände in dieser Gruppe."

    return f"""Du bist ein hilfreicher Assistent für die LendApp – eine App zum Ausleihen von Gegenständen.

Der eingeloggte Benutzer heisst: {user.name}

Gegenstände in seiner Gruppe (nur diese kennst du, zeige nie andere):
{items_text}

Beantworte Fragen nur auf Basis dieser Daten. Antworte auf Deutsch, kurz und freundlich.
Wenn du etwas nicht weisst oder keine Daten hast, sag das ehrlich.
Gib keine Informationen über Gegenstände ausserhalb dieser Gruppe."""


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
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            res.raise_for_status()
            data_out = res.json()
            answer = data_out["message"]["content"]
            return {"answer": answer, "model": OLLAMA_MODEL}
    except httpx.ConnectError:
        raise HTTPException(503, "Ollama nicht erreichbar – läuft der Service?")
    except Exception as e:
        raise HTTPException(500, f"AI-Fehler: {str(e)}")


@router.get("/status")
async def ai_status():
    """Prüft ob Ollama erreichbar ist."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in res.json().get("models", [])]
            available = OLLAMA_MODEL in models or any(OLLAMA_MODEL.split(":")[0] in m for m in models)
            return {
                "ollama": "online",
                "model": OLLAMA_MODEL,
                "model_available": available,
                "available_models": models,
            }
    except:
        return {"ollama": "offline", "model": OLLAMA_MODEL, "model_available": False}
