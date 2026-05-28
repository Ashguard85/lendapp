from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User


def get_current_user(x_user_id: int = Header(...), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == x_user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    return user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Kein Admin-Zugriff")
    return current_user
