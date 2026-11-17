from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from models import Incident

SLA_MINUTES = {
    "P1": 30,
    "P2": 120,
    "P3": 480,
    "P4": 1440,
}


def compute_sla_deadline(priority, from_time: Optional[datetime] = None) -> datetime:
    """Return the SLA deadline datetime for a given priority."""
    key = getattr(priority, "value", priority)
    if key not in SLA_MINUTES:
        raise ValueError(f"Unknown priority for SLA: {priority!r}")
    if from_time is None:
        from_time = datetime.utcnow()
    return from_time + timedelta(minutes=SLA_MINUTES[key])


def check_sla_violated(incident: "Incident") -> bool:
    """True if the SLA was breached (resolved late, or still open past deadline)."""
    if incident.sla_deadline is None:
        return False
    reference = incident.resolved_at or datetime.utcnow()
    return reference > incident.sla_deadline