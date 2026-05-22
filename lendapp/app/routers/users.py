from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.models import User
from app.schemas.schemas import UserCreate, UserOut
from app.auth import hash_password, verify_password

router = APIRouter()

# ─────────────────────────────
# LOGIN SCHEMA
# ─────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


# ─────────────────────────────
# REGISTER
# ─────────────────────────────
@router.post("/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):

    print("RAW DATA:", data)
    print("TYPE:", type(data.password))
    print("VALUE:", data.password)
    print("LENGTH:", len(str(data.password)))

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")

    user = User(
        name=data.name,
        email=data.email,
        password=hash_password(str(data.password))  # bcrypt fix (kein [:72] nötig mehr)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ─────────────────────────────
# LOGIN (FIXED)
# ─────────────────────────────
@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password):
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
