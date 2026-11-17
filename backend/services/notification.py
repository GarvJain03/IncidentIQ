from datetime import datetime
from sqlalchemy.orm import Session
from models import Notification


def send_notification(db: Session, user_id: int, message: str) -> Notification:
    """Create and persist a simulated in-app notification."""
    notification = Notification(
        user_id=user_id,
        message=message,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
