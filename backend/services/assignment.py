from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func


class AssignmentStrategy(ABC):
    @abstractmethod
    def assign(self, db: Session, incident) -> Optional[int]:
        """Return technician user_id or None."""
        ...


class LoadBasedAssignmentStrategy(AssignmentStrategy):
    def assign(self, db: Session, incident) -> Optional[int]:
        from models import User, Incident, UserRole, IncidentStatus

        technicians = db.query(User).filter(User.role == UserRole.TECHNICIAN).all()
        if not technicians:
            return None

        active_statuses = [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]
        best_tech = None
        best_count = None

        for tech in technicians:
            count = (
                db.query(Incident)
                .filter(
                    Incident.assigned_to_id == tech.id,
                    Incident.status.in_(active_statuses),
                )
                .count()
            )
            if best_count is None or count < best_count:
                best_count = count
                best_tech = tech

        return best_tech.id if best_tech else None


class ExperienceBasedAssignmentStrategy(AssignmentStrategy):
    def __init__(self, max_active_load: int = 10):
        self.max_active_load = max_active_load

    def assign(self, db: Session, incident) -> Optional[int]:
        from models import User, Incident, UserRole, IncidentStatus

        technicians = db.query(User).filter(User.role == UserRole.TECHNICIAN).all()
        if not technicians:
            return None

        done_statuses = [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]
        active_statuses = [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS]
        category = getattr(incident, "category", None)

        def resolved_count(tech_id: int, by_category: bool) -> int:
            q = db.query(func.count(Incident.id)).filter(
                Incident.assigned_to_id == tech_id,
                Incident.status.in_(done_statuses),
            )
            if by_category and category is not None:
                q = q.filter(Incident.category == category)
            return q.scalar() or 0

        def active_count(tech_id: int) -> int:
            return (
                db.query(func.count(Incident.id))
                .filter(
                    Incident.assigned_to_id == tech_id,
                    Incident.status.in_(active_statuses),
                )
                .scalar()
                or 0
            )

        candidates = []
        for tech in technicians:
            load = active_count(tech.id)
            if load >= self.max_active_load:
                continue
            candidates.append(
                (
                    resolved_count(tech.id, by_category=True),  # category experience
                    resolved_count(tech.id, by_category=False),  # overall experience
                    -load,  # prefer lower load
                    tech.id,
                )
            )

        # Everyone overloaded: fall back to the full pool, ignoring the cap
        if not candidates:
            for tech in technicians:
                candidates.append(
                    (
                        resolved_count(tech.id, True),
                        resolved_count(tech.id, False),
                        -active_count(tech.id),
                        tech.id,
                    )
                )

        best = max(candidates)
        return best[3]


class PriorityRoutedAssignmentStrategy(AssignmentStrategy):
    """
    High-priority incidents -> experience-based.
    Everything else -> load-based.
    Falls back to the other strategy if the first finds no one.
    """

    def __init__(
        self,
        experience_priorities=("P1", "P2"),
        load_strategy: Optional[AssignmentStrategy] = None,
        experience_strategy: Optional[AssignmentStrategy] = None,
    ):
        self.experience_priorities = set(experience_priorities)
        self.load = load_strategy or LoadBasedAssignmentStrategy()
        self.experience = experience_strategy or ExperienceBasedAssignmentStrategy()

    def assign(self, db: Session, incident) -> Optional[int]:
        priority = getattr(incident.priority, "value", incident.priority)

        if priority in self.experience_priorities:
            primary, secondary = self.experience, self.load
        else:
            primary, secondary = self.load, self.experience

        tech_id = primary.assign(db, incident)
        if tech_id is None:
            tech_id = secondary.assign(db, incident)
        return tech_id
