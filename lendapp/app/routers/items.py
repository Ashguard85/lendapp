from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
from app.database import get_db
from app.models.models import Item, GroupMember
from app.schemas.schemas import ItemCreate, ItemUpdate, ItemOut

router = APIRouter()


def _check_member(db, group_id, user_id):
    if not db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first():
        raise HTTPException(403, "Nicht Mitglied dieser Gruppe")


@router.post("/", response_model=ItemOut, status_code=201)
def create_item(data: ItemCreate, user_id: int, db: Session = Depends(get_db)):
    _check_member(db, data.group_id, user_id)
    item = Item(**data.model_dump(), owner_id=user_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/group/{group_id}", response_model=List[ItemOut])
def list_items(
    group_id: int,
    user_id: int,
    category: Optional[str] = None,
    available_only: bool = False,
    db: Session = Depends(get_db),
):
    _check_member(db, group_id, user_id)
    # Soft delete: nur nicht gelöschte Items
    q = db.query(Item).filter(Item.group_id == group_id, Item.deleted_at == None)
    if category:
        q = q.filter(Item.category == category)
    if available_only:
        q = q.filter(Item.is_available == True)
    return q.all()


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id, Item.deleted_at == None).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    return item


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, data: ItemUpdate, user_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id, Item.deleted_at == None).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    if item.owner_id != user_id:
        raise HTTPException(403, "Nur der Besitzer darf bearbeiten")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, user_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id, Item.deleted_at == None).first()
    if not item:
        raise HTTPException(404, "Gegenstand nicht gefunden")
    if item.owner_id != user_id:
        raise HTTPException(403, "Nur der Besitzer darf löschen")
    # Soft delete – Buchungshistorie bleibt erhalten
    item.deleted_at = func.now()
    item.is_available = False
    db.commit()
