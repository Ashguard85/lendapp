from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.schemas.schemas import UserCreate, UserOut
from app.auth import hash_password, verify_password

router = APIRouter()

# ─────────────────────────────
# REGISTER
# ─────────────────────────────
@router.post("/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):

    # 🔍 DEBUG (nur temporär lassen)
    print("RAW DATA:", data)
    print("TYPE:", type(data.password))
    print("VALUE:", data.password)
    print("LENGTH:", len(str(data.password)))

    # ❌ Check: Email existiert schon?
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")

    # 🔐 User erstellen
    user = User(
        name=data.name,
        email=data.email,
        password=hash_password(str(data.password)[:72])  # bcrypt safety
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ─────────────────────────────
# LOGIN
# ─────────────────────────────
@router.post("/login")
def login(email: str, password: str, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.password):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")

    return {
        "user_id": user.id,
        "name": user.name,
        "message": "Login erfolgreich"
    }


# ─────────────────────────────
# GET USER
# ─────────────────────────────
@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    return user
