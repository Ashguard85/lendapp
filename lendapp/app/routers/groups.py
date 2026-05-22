import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Group, GroupMember, User
from app.schemas.schemas import GroupCreate, GroupOut

router = APIRouter()


@router.post("/", response_model=GroupOut, status_code=201)
def create_group(data: GroupCreate, user_id: int, db: Session = Depends(get_db)):
    group = Group(name=data.name, invite_code=secrets.token_urlsafe(8))
    db.add(group)
    db.flush()
    member = GroupMember(group_id=group.id, user_id=user_id, is_admin=True)
    db.add(member)
    db.commit()
    db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden")
    return group


@router.post("/{group_id}/join")
def join_group(group_id: int, invite_code: str, user_id: int, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id, Group.invite_code == invite_code).first()
    if not group:
        raise HTTPException(404, "Ungültiger Einladungslink")
    already = db.query(GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
    if already:
        raise HTTPException(400, "Bereits Mitglied")
    db.add(GroupMember(group_id=group_id, user_id=user_id))
    db.commit()
    return {"message": f"Willkommen in Gruppe '{group.name}'!"}


@router.get("/{group_id}/members")
def list_members(group_id: int, db: Session = Depends(get_db)):
    members = (
        db.query(GroupMember, User)
        .join(User, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == group_id)
        .all()
    )
    return [
        {"user_id": u.id, "name": u.name, "email": u.email, "is_admin": m.is_admin, "joined_at": m.joined_at}
        for m, u in members
    ]
