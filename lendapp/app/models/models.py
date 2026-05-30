from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class BookingStatus(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"
    returned = "returned"
    external = "external"


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    email      = Column(String, unique=True, index=True, nullable=False)
    password   = Column(String, nullable=False)
    is_admin   = Column(Boolean, default=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    items             = relationship("Item", back_populates="owner")
    bookings          = relationship("Booking", back_populates="borrower")
    group_memberships = relationship("GroupMember", back_populates="user")


class Group(Base):
    __tablename__ = "groups"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    invite_code = Column(String, unique=True, index=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at  = Column(DateTime(timezone=True), nullable=True)

    members = relationship("GroupMember", back_populates="group")
    items   = relationship("Item", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"

    id        = Column(Integer, primary_key=True, index=True)
    group_id  = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_admin  = Column(Boolean, default=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("Group", back_populates="members")
    user  = relationship("User", back_populates="group_memberships")


class Item(Base):
    __tablename__ = "items"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)
    description  = Column(String, default="")
    category     = Column(String, default="Sonstiges")
    image_url    = Column(String, nullable=True)
    thumb_url    = Column(String, nullable=True)
    max_days     = Column(Integer, default=14)
    is_available = Column(Boolean, default=True)
    owner_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    # group_id ist nullable – Items sind ueber Gruppenmitgliedschaft des Besitzers sichtbar
    group_id     = Column(Integer, ForeignKey("groups.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at   = Column(DateTime(timezone=True), nullable=True)

    owner    = relationship("User", back_populates="items")
    group    = relationship("Group", back_populates="items")
    bookings = relationship("Booking", back_populates="item")


class Booking(Base):
    __tablename__ = "bookings"

    id            = Column(Integer, primary_key=True, index=True)
    item_id       = Column(Integer, ForeignKey("items.id"), nullable=False)
    borrower_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    external_name = Column(String, nullable=True)
    date_from     = Column(DateTime, nullable=False)
    date_to       = Column(DateTime, nullable=True)
    status        = Column(Enum(BookingStatus), default=BookingStatus.pending)
    note          = Column(String, default="")
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    item     = relationship("Item", back_populates="bookings")
    borrower = relationship("User", back_populates="bookings")
