from enum import Enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base


class UserRole(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    TECHNICIAN = "TECHNICIAN"
    ADMIN = "ADMIN"


class IncidentStatus(str, Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class IncidentCategory(str, Enum):
    APPLICATION = "APPLICATION"
    NETWORK = "NETWORK"
    HARDWARE = "HARDWARE"
    ACCESS = "ACCESS"
    OTHER = "OTHER"


class Priority(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default=UserRole.EMPLOYEE)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_incidents = relationship(
        "Incident", foreign_keys="Incident.created_by_id", back_populates="creator"
    )
    assigned_incidents = relationship(
        "Incident", foreign_keys="Incident.assigned_to_id", back_populates="assignee"
    )
    notifications = relationship("Notification", back_populates="user")
    audit_logs = relationship("AuditLog", foreign_keys="AuditLog.actor_id", back_populates="actor")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False, default=IncidentCategory.OTHER)
    priority = Column(String, nullable=False, default=Priority.P4)
    status = Column(String, nullable=False, default=IncidentStatus.NEW)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    resolution_notes = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_category = Column(String, nullable=True)
    ai_priority = Column(String, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    ai_steps_json = Column(Text, nullable=True)  # JSON string of list

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    sla_deadline = Column(DateTime, nullable=True)
    sla_violated = Column(Boolean, default=False)

    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_incidents")
    assignee = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_incidents")
    audit_logs = relationship("AuditLog", back_populates="incident")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    action = Column(String, nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="audit_logs")
    actor = relationship("User", foreign_keys=[actor_id], back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
