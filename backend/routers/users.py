from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User, Incident, UserRole, IncidentStatus
from auth import require_role

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/")
def list_users(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/technicians")
def list_technicians(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    technicians = db.query(User).filter(User.role == UserRole.TECHNICIAN).all()
    active_statuses = [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]
    result = []
    for tech in technicians:
        count = (
            db.query(Incident)
            .filter(
                Incident.assigned_to_id == tech.id,
                Incident.status.in_(active_statuses),
            )
            .count()
        )
        result.append(
            {
                "id": tech.id,
                "username": tech.username,
                "email": tech.email,
                "role": tech.role,
                "active_ticket_count": count,
            }
        )
    return result
