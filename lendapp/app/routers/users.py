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

    print("RAW DATA:", data)
    print("DICT:", data.dict())
    print("PASSWORD:", data.password)

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "E-Mail bereits registriert")

    user = User(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
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
        raise HTTPException(401, "Ungültige Anmeldedaten")

    return {"user_id": user.id, "name": user.name}
