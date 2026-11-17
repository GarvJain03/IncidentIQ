import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    Incident,
    AuditLog,
    Notification,
    UserRole,
    IncidentStatus,
    IncidentCategory,
    Priority,
)
from schemas import (
    IncidentCreate,
    IncidentRead,
    IncidentDetail,
    IncidentStatusUpdate,
    AuditLogRead,
)
from auth import get_current_user, require_role
from services.priority import KeywordPriorityStrategy
from services.assignment import PriorityRoutedAssignmentStrategy
from services.sla import compute_sla_deadline
from services.notification import send_notification
from services.gemini_service import analyze_incident
from datetime import datetime, timezone

router = APIRouter(prefix="/api/incidents", tags=["Incidents"])

priority_strategy = KeywordPriorityStrategy()
assignment_strategy = PriorityRoutedAssignmentStrategy(
    experience_priorities=("P1", "P2")
)

# Allowed state machine transitions
VALID_TRANSITIONS = {
    IncidentStatus.NEW: [IncidentStatus.ASSIGNED],
    IncidentStatus.ASSIGNED: [IncidentStatus.IN_PROGRESS],
    IncidentStatus.IN_PROGRESS: [IncidentStatus.RESOLVED],
    IncidentStatus.RESOLVED: [IncidentStatus.CLOSED],
    IncidentStatus.CLOSED: [],
}


def _iso_utc(v):
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()  # e.g. 2026-11-18T18:50:00+00:00
    return v


def _incident_to_dict(incident: Incident, db: Session) -> dict:
    d = {c.name: _iso_utc(getattr(incident, c.name)) for c in incident.__table__.columns}
    creator = db.query(User).filter(User.id == incident.created_by_id).first()
    assignee = (
        db.query(User).filter(User.id == incident.assigned_to_id).first()
        if incident.assigned_to_id
        else None
    )
    d["created_by_username"] = creator.username if creator else None
    d["assigned_to_username"] = assignee.username if assignee else None
    return d


def _add_audit(
    db: Session,
    incident_id: int,
    action: str,
    actor_id: int,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    log = AuditLog(
        incident_id=incident_id,
        action=action,
        actor_id=actor_id,
        old_status=old_status,
        new_status=new_status,
        metadata_json=json.dumps(metadata) if metadata else None,
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    db.commit()


@router.get("/")
def list_incidents(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if current_user.role == UserRole.EMPLOYEE:
        incidents = (
            db.query(Incident).filter(Incident.created_by_id == current_user.id).all()
        )
    elif current_user.role == UserRole.TECHNICIAN:
        incidents = (
            db.query(Incident).filter(Incident.assigned_to_id == current_user.id).all()
        )
    else:  # ADMIN
        incidents = db.query(Incident).all()
    return [_incident_to_dict(i, db) for i in incidents]


@router.post("/", status_code=201)
async def create_incident(
    payload: IncidentCreate,
    current_user: User = Depends(require_role(UserRole.EMPLOYEE)),
    db: Session = Depends(get_db),
):
    # 1. Create incident with status=NEW
    incident = Incident(
        title=payload.title,
        description=payload.description,
        status=IncidentStatus.NEW,
        created_by_id=current_user.id,
        category=IncidentCategory.OTHER,
        priority=Priority.P4,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # 2. Keyword priority
    kw_priority = priority_strategy.calculate(payload.description, "")
    incident.priority = kw_priority

    # 3. AI analysis
    ai_result = await analyze_incident(payload.title, payload.description)
    incident.ai_summary = ai_result.get("ai_summary", "")
    incident.ai_category = ai_result.get("category", "OTHER")
    incident.ai_priority = ai_result.get("suggested_priority", kw_priority)
    incident.ai_reasoning = ai_result.get("priority_reasoning", "")
    steps = ai_result.get("suggested_resolution_steps", [])
    incident.ai_steps_json = json.dumps(steps)
    # Use AI category if valid
    ai_cat = ai_result.get("category", "OTHER")
    if ai_cat in [c.value for c in IncidentCategory]:
        incident.category = ai_cat

    db.commit()
    db.refresh(incident)

    # 4. Auto-assign
    tech_id = assignment_strategy.assign(db, incident)
    if tech_id:
        incident.assigned_to_id = tech_id
        incident.status = IncidentStatus.ASSIGNED
    else:
        incident.status = IncidentStatus.NEW

    # 5. SLA deadline
    incident.sla_deadline = compute_sla_deadline(kw_priority)
    incident.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)

    # 6. Audit logs
    _add_audit(
        db,
        incident.id,
        "INCIDENT_CREATED",
        current_user.id,
        new_status=IncidentStatus.NEW,
    )
    if tech_id:
        _add_audit(
            db,
            incident.id,
            "AUTO_ASSIGNED",
            current_user.id,
            old_status=IncidentStatus.NEW,
            new_status=IncidentStatus.ASSIGNED,
            metadata={"assigned_to_id": tech_id},
        )

    # 7. Return with AI analysis embedded
    result = _incident_to_dict(incident, db)
    result["ai_analysis"] = ai_result
    return result


@router.get("/{incident_id}")
def get_incident(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    # Access control
    if (
        current_user.role == UserRole.EMPLOYEE
        and incident.created_by_id != current_user.id
    ):
        raise HTTPException(403, "Forbidden")
    if (
        current_user.role == UserRole.TECHNICIAN
        and incident.assigned_to_id != current_user.id
    ):
        raise HTTPException(403, "Forbidden")

    result = _incident_to_dict(incident, db)
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.incident_id == incident_id)
        .order_by(AuditLog.timestamp)
        .all()
    )
    result["audit_log"] = []
    for log in audit_logs:
        actor = db.query(User).filter(User.id == log.actor_id).first()
        entry = {
            "id": log.id,
            "incident_id": log.incident_id,
            "action": log.action,
            "actor_id": log.actor_id,
            "actor_username": actor.username if actor else None,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "metadata_json": log.metadata_json,
            "timestamp": log.timestamp,
        }
        result["audit_log"].append(entry)
    return result


@router.patch("/{incident_id}/status")
def update_status(
    incident_id: int,
    payload: IncidentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")

    old_status = incident.status
    new_status = (
        payload.new_status.value
        if hasattr(payload.new_status, "value")
        else payload.new_status
    )

    # State machine validation
    current_status = IncidentStatus(old_status)
    allowed = [s.value for s in VALID_TRANSITIONS.get(current_status, [])]
    if new_status not in allowed:
        raise HTTPException(
            400, f"Invalid status transition: {old_status} → {new_status}"
        )

    # Role-based access
    if current_user.role == UserRole.TECHNICIAN:
        if incident.assigned_to_id != current_user.id:
            raise HTTPException(403, "You can only update your own assigned incidents")
        if new_status == IncidentStatus.CLOSED:
            raise HTTPException(403, "Only the creator can close an incident")
    elif current_user.role == UserRole.EMPLOYEE:
        if new_status != IncidentStatus.CLOSED:
            raise HTTPException(
                403, "Employees can only close (RESOLVED→CLOSED) incidents they created"
            )
        if incident.created_by_id != current_user.id:
            raise HTTPException(403, "Forbidden")

    # Apply transition
    incident.status = new_status
    incident.updated_at = datetime.utcnow()

    if new_status == IncidentStatus.RESOLVED:
        incident.resolved_at = datetime.utcnow()
        if payload.resolution_notes:
            incident.resolution_notes = payload.resolution_notes
        # Check SLA
        if incident.sla_deadline and datetime.utcnow() > incident.sla_deadline:
            incident.sla_violated = True
        # Notify creator
        send_notification(
            db,
            incident.created_by_id,
            f"Your incident #{incident.id} '{incident.title}' has been resolved.",
        )

    if new_status == IncidentStatus.CLOSED:
        if incident.assigned_to_id:
            send_notification(
                db,
                incident.assigned_to_id,
                f"Incident #{incident.id} '{incident.title}' has been closed by the reporter.",
            )

    db.commit()
    db.refresh(incident)

    _add_audit(
        db,
        incident.id,
        "STATUS_CHANGED",
        current_user.id,
        old_status=old_status,
        new_status=new_status,
    )

    return _incident_to_dict(incident, db)


@router.get("/{incident_id}/audit")
def get_audit(
    incident_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.incident_id == incident_id)
        .order_by(AuditLog.timestamp)
        .all()
    )
    result = []
    for log in logs:
        actor = db.query(User).filter(User.id == log.actor_id).first()
        result.append(
            {
                "id": log.id,
                "incident_id": log.incident_id,
                "action": log.action,
                "actor_id": log.actor_id,
                "actor_username": actor.username if actor else None,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "metadata_json": log.metadata_json,
                "timestamp": log.timestamp,
            }
        )
    return result
