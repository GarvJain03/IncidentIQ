from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
from models import UserRole, IncidentStatus, IncidentCategory, Priority


# ── User Schemas ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.EMPLOYEE


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserRead


# ── Incident Schemas ──────────────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    title: str
    description: str


class IncidentStatusUpdate(BaseModel):
    new_status: IncidentStatus
    resolution_notes: Optional[str] = None


class AuditLogRead(BaseModel):
    id: int
    incident_id: int
    action: str
    actor_id: int
    old_status: Optional[str]
    new_status: Optional[str]
    metadata_json: Optional[str]
    timestamp: datetime

    model_config = {"from_attributes": True}


class IncidentRead(BaseModel):
    id: int
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_by_id: int
    assigned_to_id: Optional[int]
    resolution_notes: Optional[str]
    ai_summary: Optional[str]
    ai_category: Optional[str]
    ai_priority: Optional[str]
    ai_reasoning: Optional[str]
    ai_steps_json: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    sla_deadline: Optional[datetime]
    sla_violated: bool
    created_by_username: Optional[str] = None
    assigned_to_username: Optional[str] = None

    model_config = {"from_attributes": True}


class IncidentDetail(IncidentRead):
    audit_logs: List[AuditLogRead] = []


# ── Notification Schemas ──────────────────────────────────────────────────────

class NotificationRead(BaseModel):
    id: int
    user_id: int
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Admin Schemas ─────────────────────────────────────────────────────────────

class TechnicianWorkload(BaseModel):
    id: int
    username: str
    active_ticket_count: int


class AdminStats(BaseModel):
    open_count: int
    resolved_count: int
    closed_count: int
    by_category: dict
    sla_violations: int
    technician_workload: List[TechnicianWorkload]
