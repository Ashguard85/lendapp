from passlib.context import CryptContext
from fastapi import HTTPException, Header
from sqlalchemy.orm import Session
from app.models.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_current_user(x_user_id: int = Header(...), db: Session = None) -> User:
    """
    Simple header-based auth for development.
    In production replace with JWT (e.g. python-jose).
    Send header:  X-User-Id: 1
    """
    user = db.query(User).filter(User.id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
