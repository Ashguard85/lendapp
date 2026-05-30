from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from app.database import get_db
from app.models.models import User, GroupMember, Group
from app.schemas.schemas import UserCreate, UserOut
from app.auth import hash_password, verify_password
from app.dependencies import check_rate_limit

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, "register")
    # Passwort-Staerke pruefen
    pw = data.password
    if len(pw) < 8:
        raise HTTPException(400, "Passwort muss mindestens 8 Zeichen haben")
    if not any(c.isupper() for c in pw):
        raise HTTPException(400, "Passwort muss mindestens einen Grossbuchstaben enthalten")
    if not any(c.islower() for c in pw):
        raise HTTPException(400, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in pw):
        raise HTTPException(400, "Passwort muss mindestens ein Sonderzeichen enthalten (!@#$%^&*...)")
    if db.query(User).filter(User.email == data.email, User.deleted_at == None).first():
        raise HTTPException(400, "E-Mail bereits registriert")
    is_first_user = db.query(User).filter(User.deleted_at == None).count() == 0
    user = User(
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        is_admin=is_first_user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login")
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, "login")
    user = db.query(User).filter(
        User.email == data.email,
        User.deleted_at == None,
    ).first()
    # Gleiche Fehlermeldung ob User nicht existiert oder Passwort falsch (kein User-Enumeration)
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(401, "Ungueltige Anmeldedaten")
    if not user.is_active:
        raise HTTPException(403, "Konto gesperrt")

    memberships = (
        db.query(GroupMember, Group)
        .join(Group, GroupMember.group_id == Group.id)
        .filter(GroupMember.user_id == user.id, Group.deleted_at == None)
        .all()
    )
    groups = [{"id": g.id, "name": g.name} for m, g in memberships]

    return {
        "user_id":  user.id,
        "name":     user.name,
        "is_admin": user.is_admin,
        "groups":   groups,
        "message":  "Login erfolgreich",
    }


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(404, "User nicht gefunden")
    return user
