from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.models import User, GroupMember
from app.schemas.schemas import UserCreate, UserOut
from app.auth import hash_password, verify_password

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(401, "Ungültige Anmeldedaten")
    
    # Erste Gruppe des Users mitliefern
    membership = db.query(GroupMember).filter(
        GroupMember.user_id == user.id
    ).first()
    group_id = membership.group_id if membership else None

    return {
        "user_id": user.id,
        "name": user.name,
        "group_id": group_id,
        "message": "Login erfolgreich"
    }


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User nicht gefunden")
    return user
