from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel, EmailStr
from typing import Optional
import secrets
from app.database import get_db
from app.models.models import User, Group, GroupMember, Item, Booking
from app.auth import hash_password
from app.dependencies import get_admin_user

router = APIRouter()


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    is_admin: Optional[bool] = False

class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class AdminGroupCreate(BaseModel):
    name: str

class AdminGroupUpdate(BaseModel):
    name: str

class AdminItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: Optional[str] = "Sonstiges"
    image_url: Optional[str] = None
    max_days: Optional[int] = 14
    group_id: int
    owner_id: int

class AdminItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    max_days: Optional[int] = None
    is_available: Optional[bool] = None

class PasswordReset(BaseModel):
    new_password: str


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    return {
        "users":          db.query(User).filter(User.deleted_at == None).count(),
        "groups":         db.query(Group).filter(Group.deleted_at == None).count(),
        "items":          db.query(Item).filter(Item.deleted_at == None).count(),
        "bookings":       db.query(Booking).count(),
        "active_users":   db.query(User).filter(User.is_active == True, User.deleted_at == None).count(),
        "inactive_users": db.query(User).filter(User.is_active == False, User.deleted_at == None).count(),
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    users = db.query(User).filter(User.deleted_at == None).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "is_admin": u.is_admin, "is_active": u.is_active, "created_at": u.created_at, "groups": [m.group_id for m in u.group_memberships], "item_count": len([i for i in u.items if i.deleted_at is None])} for u in users]


@router.post("/users", status_code=201)
def create_user(data: AdminUserCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    if db.query(User).filter(User.email == data.email, User.deleted_at == None).first():
        raise HTTPException(400, "E-Mail bereits registriert")
    user = User(name=data.name, email=data.email, password=hash_password(data.password), is_admin=data.is_admin)
    db.add(user); db.commit(); db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


@router.patch("/users/{user_id}")
def update_user(user_id: int, data: AdminUserUpdate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(404, "User nicht gefunden")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    return {"id": user.id, "name": user.name, "is_active": user.is_active, "is_admin": user.is_admin}


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: int, data: PasswordReset, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(404, "User nicht gefunden")
    user.password = hash_password(data.new_password)
    db.commit()
    return {"message": "Passwort zurückgesetzt"}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    if admin.id == user_id:
        raise HTTPException(400, "Du kannst dich nicht selbst löschen")
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(404, "User nicht gefunden")
    user.deleted_at = func.now()
    db.commit()


@router.get("/groups")
def list_groups(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    groups = db.query(Group).filter(Group.deleted_at == None).all()
    return [{"id": g.id, "name": g.name, "invite_code": g.invite_code, "created_at": g.created_at, "member_count": len(g.members), "item_count": len([i for i in g.items if i.deleted_at is None])} for g in groups]


@router.post("/groups", status_code=201)
def create_group(data: AdminGroupCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    group = Group(name=data.name, invite_code=secrets.token_urlsafe(8))
    db.add(group); db.commit(); db.refresh(group)
    return {"id": group.id, "name": group.name, "invite_code": group.invite_code}


@router.patch("/groups/{group_id}")
def update_group(group_id: int, data: AdminGroupUpdate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    group = db.query(Group).filter(Group.id == group_id, Group.deleted_at == None).first()
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden")
    group.name = data.name; db.commit()
    return {"id": group.id, "name": group.name}


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    group = db.query(Group).filter(Group.id == group_id, Group.deleted_at == None).first()
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden")
    group.deleted_at = func.now()
    db.commit()


@router.post("/groups/{group_id}/members/{user_id}")
def add_member(group_id: int, user_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    if db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first():
        raise HTTPException(400, "Bereits Mitglied")
    db.add(GroupMember(group_id=group_id, user_id=user_id)); db.commit()
    return {"message": "Mitglied hinzugefügt"}


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
def remove_member(group_id: int, user_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    member = db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        raise HTTPException(404, "Mitglied nicht gefunden")
    db.delete(member); db.commit()


@router.get("/items")
def list_items(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    items = db.query(Item).filter(Item.deleted_at == None).all()
    return [{"id": i.id, "name": i.name, "category": i.category, "description": i.description, "image_url": i.image_url, "max_days": i.max_days, "is_available": i.is_available, "owner_id": i.owner_id, "group_id": i.group_id, "created_at": i.created_at} for i in items]


@router.post("/items", status_code=201)
def create_item(data: AdminItemCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    item = Item(**data.model_dump()); db.add(item); db.commit(); db.refresh(item)
    return {"id": item.id, "name": item.name}


@router.patch("/items/{item_id}")
def update_item(item_id: int, data: AdminItemUpdate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    item = db.query(Item).filter(Item.id == item_id, Item.deleted_at == None).first()
    if not item:
        raise HTTPException(404, "Artikel nicht gefunden")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    return {"id": item.id, "name": item.name}


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    item = db.query(Item).filter(Item.id == item_id, Item.deleted_at == None).first()
    if not item:
        raise HTTPException(404, "Artikel nicht gefunden")
    item.deleted_at = func.now()
    item.is_available = False
    db.commit()
