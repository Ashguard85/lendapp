import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import get_db
from app.models.models import Group, GroupMember, User
from app.schemas.schemas import GroupCreate, GroupOut
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/", response_model=GroupOut, status_code=201)
def create_group(data: GroupCreate, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    group = Group(name=data.name, invite_code=secrets.token_urlsafe(8))
    db.add(group)
    db.flush()
    db.add(GroupMember(group_id=group.id, user_id=current_user.id, is_admin=True))
    db.commit()
    db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    # Nur Mitglieder duerfen Gruppeninfos sehen
    member = db.query(GroupMember).filter_by(group_id=group_id, user_id=current_user.id).first()
    if not member:
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")
    group = db.query(Group).filter(Group.id == group_id, Group.deleted_at == None).first()
    if not group:
        raise HTTPException(404, "Gruppe nicht gefunden")
    return group


@router.post("/join")
def join_group(invite_code: str, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    group = db.query(Group).filter(
        Group.invite_code == invite_code,
        Group.deleted_at == None,
    ).first()
    if not group:
        raise HTTPException(404, "Ungueltiger Einladungscode")
    already = db.query(GroupMember).filter_by(group_id=group.id, user_id=current_user.id).first()
    if already:
        raise HTTPException(400, "Bereits Mitglied")
    db.add(GroupMember(group_id=group.id, user_id=current_user.id))
    db.commit()
    return {"message": "Willkommen in " + group.name + "!", "group_id": group.id, "group_name": group.name}


@router.delete("/{group_id}/leave", status_code=204)
def leave_group(group_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    member = db.query(GroupMember).filter_by(group_id=group_id, user_id=current_user.id).first()
    if not member:
        raise HTTPException(404, "Nicht Mitglied dieser Gruppe")
    if member.is_admin:
        admins = db.query(GroupMember).filter_by(group_id=group_id, is_admin=True).count()
        if admins <= 1:
            raise HTTPException(400, "Du bist der letzte Admin. Bitte zuerst jemand anderen zum Admin machen.")
    db.delete(member)
    db.commit()


@router.get("/{group_id}/members")
def list_members(group_id: int, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    # Nur Mitglieder duerfen Mitgliederliste sehen
    if not db.query(GroupMember).filter_by(group_id=group_id, user_id=current_user.id).first():
        raise HTTPException(403, "Kein Zugriff auf diese Gruppe")
    members = (
        db.query(GroupMember, User)
        .join(User, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == group_id, User.deleted_at == None)
        .all()
    )
    return [
        {"user_id": u.id, "name": u.name, "email": u.email, "is_admin": m.is_admin, "joined_at": m.joined_at}
        for m, u in members
    ]


@router.get("/user/{user_id}/all")
def get_user_groups(user_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    # User darf nur eigene Gruppen abrufen
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(403, "Kein Zugriff")
    memberships = (
        db.query(GroupMember, Group)
        .join(Group, GroupMember.group_id == Group.id)
        .filter(GroupMember.user_id == user_id, Group.deleted_at == None)
        .all()
    )
    return [
        {"id": g.id, "name": g.name, "invite_code": g.invite_code, "is_admin": m.is_admin}
        for m, g in memberships
    ]
