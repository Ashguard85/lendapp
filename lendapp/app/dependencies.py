from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from collections import defaultdict
from datetime import datetime, timedelta
import os

# ── Rate Limiting (einfach, in-memory) ──────────────────
_rate_store: dict = defaultdict(list)

RATE_LIMITS = {
    "login":    (5,  60),   # 5 Versuche pro 60 Sekunden
    "register": (3,  60),   # 3 Versuche pro 60 Sekunden
    "upload":   (20, 60),   # 20 Uploads pro 60 Sekunden
    "ai":       (15, 60),   # 15 AI-Anfragen pro 60 Sekunden
    "default":  (60, 60),   # 60 Anfragen pro 60 Sekunden
}


def check_rate_limit(request: Request, category: str = "default"):
    client_ip = request.client.host if request.client else "unknown"
    key = category + ":" + client_ip
    now = datetime.utcnow()
    max_calls, window_secs = RATE_LIMITS.get(category, RATE_LIMITS["default"])
    cutoff = now - timedelta(seconds=window_secs)
    # Alte Eintraege entfernen
    _rate_store[key] = [t for t in _rate_store[key] if t > cutoff]
    if len(_rate_store[key]) >= max_calls:
        raise HTTPException(429, "Zu viele Anfragen – bitte kurz warten")
    _rate_store[key].append(now)
    # Speicher bereinigen: Keys mit leeren Listen loeschen
    if len(_rate_store) > 10000:
        empty = [k for k, v in _rate_store.items() if not v]
        for k in empty:
            del _rate_store[k]


# ── Auth Dependencies ────────────────────────────────────
def get_current_user(x_user_id: int = Header(...), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(
        User.id == x_user_id,
        User.is_active == True,
        User.deleted_at == None,
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    return user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Kein Admin-Zugriff")
    return current_user


# ── Reminder Secret (fuer den Cronjob-Container) ─────────
REMINDER_SECRET = os.getenv("REMINDER_SECRET", "")

def check_reminder_secret(x_reminder_secret: str = Header(default="")):
    if REMINDER_SECRET and x_reminder_secret != REMINDER_SECRET:
        raise HTTPException(403, "Ungueltiger Reminder-Secret")


# Docs-Endpunkt Rate Limit (Brute-Force Schutz)
_docs_attempts: dict = defaultdict(list)

def check_docs_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=300)  # 5 Minuten Fenster
    _docs_attempts[client_ip] = [t for t in _docs_attempts[client_ip] if t > cutoff]
    if len(_docs_attempts[client_ip]) >= 10:  # Max 10 Versuche pro 5 Min
        raise HTTPException(429, "Zu viele Versuche")
    _docs_attempts[client_ip].append(now)
