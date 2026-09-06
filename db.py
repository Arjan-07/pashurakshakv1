from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime
from typing import Iterator, Optional

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker
from sqlalchemy.types import TypeDecorator

DATABASE_URL = os.environ.get("PASHURAKSHAK_DATABASE_URL", "sqlite:///./pashurakshak.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class JSONList(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return json.dumps(value or [])

    def process_result_value(self, value, dialect):
        return json.loads(value) if value else []


def utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # farmer | veterinarian | field_worker
    salt = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)

    animals = relationship("Animal", back_populates="farmer")
    reports = relationship("Report", back_populates="farmer")

    @staticmethod
    def hash_password(password: str, salt: str) -> str:
        return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()

    def check_password(self, password: str) -> bool:
        return secrets.compare_digest(self.hash_password(password, self.salt), self.password_hash)


class SessionToken(Base):
    """A logged-in session. Replaces the fake 'demo-'+user_id tokens."""

    __tablename__ = "sessions"

    token = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(String, default=utcnow_iso)


class Animal(Base):
    __tablename__ = "animals"

    id = Column(String, primary_key=True)
    farmer_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    tag = Column(String, nullable=False)
    species = Column(String, nullable=False)
    breed = Column(String, default="")
    age = Column(Integer, default=0)
    sex = Column(String, default="Female")
    vaccination = Column(String, default="Unknown")
    created_at = Column(String, default=utcnow_iso)

    farmer = relationship("User", back_populates="animals")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True)
    farmer_id = Column(String, ForeignKey("users.id"), nullable=False)
    animal_id = Column(String, nullable=False)
    species = Column(String, nullable=False)
    animal_tag = Column(String, nullable=False)
    symptoms = Column(JSONList, default=list)
    severity = Column(String, default="Moderate")
    affected_animals = Column(Integer, default=1)
    deaths = Column(Integer, default=0)
    vaccination = Column(String, default="Unknown")
    description = Column(Text, default="")
    village = Column(String, default="Demo Village")
    lat = Column(Float, default=0.0)
    lng = Column(Float, default=0.0)
    risk = Column(Integer, default=0)
    risk_label = Column(String, default="Normal")
    status = Column(String, default="New")
    created_at = Column(String, default=utcnow_iso)

    farmer = relationship("User", back_populates="reports")


class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(String, primary_key=True)
    reports_count = Column(Integer, default=0)
    affected = Column(Integer, default=0)
    villages_count = Column(Integer, default=0)
    risk = Column(Integer, default=0)
    status = Column(String, default="Potential Cluster")
    lat = Column(Float, default=0.0)
    lng = Column(Float, default=0.0)
    trend = Column(String, default="Increasing")
    assigned_worker = Column(String, nullable=True)  # display name, set on assignment
    investigation_status = Column(String, default="Awaiting veterinary action")
    created_at = Column(String, default=utcnow_iso)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True)
    cluster_id = Column(String, ForeignKey("clusters.id"), nullable=True)
    priority = Column(String, default="INFO")
    message = Column(Text, nullable=False)
    created_at = Column(String, default=utcnow_iso)


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String, primary_key=True)
    cluster_id = Column(String, ForeignKey("clusters.id"), nullable=False)
    assigned_worker_id = Column(String, ForeignKey("users.id"), nullable=False)
    worker_name = Column(String, nullable=False)
    notes = Column(Text, default="")
    status = Column(String, default="Assigned")
    sample_required = Column(Boolean, default=True)
    created_at = Column(String, default=utcnow_iso)


class Sample(Base):
    __tablename__ = "samples"

    id = Column(String, primary_key=True)
    investigation_id = Column(String, ForeignKey("investigations.id"), nullable=False)
    sample_type = Column(String, default="Blood / Swab")
    status = Column(String, default="Received")
    result = Column(Text, default="")


class Vaccination(Base):
    __tablename__ = "vaccinations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    animal_id = Column(String, ForeignKey("animals.id"), nullable=False)
    vaccination = Column(String, default="Unknown")
    status = Column(String, default="Recorded")


# --------------------------------------------------------------------------
# Setup / session helpers
# --------------------------------------------------------------------------

DEMO_USERS = [
    ("farmer@demo.local", "U-FARMER", "Ravi Kumar", "farmer", "demo123"),
    ("vet@demo.local", "U-VET", "Dr. Asha Verma", "veterinarian", "demo123"),
    ("worker@demo.local", "U-WORKER", "Amit Singh", "field_worker", "demo123"),
]


def init_db() -> None:
    """Create tables if they don't exist and seed demo accounts. Safe to call every startup."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for email, user_id, name, role, password in DEMO_USERS:
            if db.get(User, user_id) is not None:
                continue
            salt = secrets.token_hex(8)
            db.add(User(
                id=user_id,
                email=email,
                name=name,
                role=role,
                salt=salt,
                password_hash=User.hash_password(password, salt),
            ))
        db.commit()


def get_db() -> Iterator[Session]:
    """FastAPI dependency: yields a session, closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()