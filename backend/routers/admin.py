from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, Incident, AuditLog, UserRole, IncidentStatus
from auth import require_role

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
def admin_stats(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    open_statuses = [IncidentStatus.NEW, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]
    open_count = db.query(Incident).filter(Incident.status.in_(open_statuses)).count()
    resolved_count = db.query(Incident).filter(Incident.status == IncidentStatus.RESOLVED).count()
    closed_count = db.query(Incident).filter(Incident.status == IncidentStatus.CLOSED).count()
    sla_violations = db.query(Incident).filter(Incident.sla_violated == True).count()

    # By category
    all_incidents = db.query(Incident).all()
    by_category: dict = {}
    for inc in all_incidents:
        cat = inc.category or "OTHER"
        by_category[cat] = by_category.get(cat, 0) + 1

    # Technician workload
    active_statuses = [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]
    technicians = db.query(User).filter(User.role == UserRole.TECHNICIAN).all()
    technician_workload = []
    for tech in technicians:
        count = (
            db.query(Incident)
            .filter(
                Incident.assigned_to_id == tech.id,
                Incident.status.in_(active_statuses),
            )
            .count()
        )
        technician_workload.append(
            {"id": tech.id, "username": tech.username, "active_ticket_count": count}
        )

    return {
        "open_count": open_count,
        "resolved_count": resolved_count,
        "closed_count": closed_count,
        "by_category": by_category,
        "sla_violations": sla_violations,
        "technician_workload": technician_workload,
    }


@router.get("/audit-logs")
def all_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
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
    total = db.query(AuditLog).count()
    return {"total": total, "skip": skip, "limit": limit, "logs": result}
