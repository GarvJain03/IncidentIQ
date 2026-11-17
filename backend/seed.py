import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from auth import hash_password
from models import User, Incident, AuditLog, UserRole, IncidentStatus, IncidentCategory, Priority


def seed_if_empty(db: Session):
    if db.query(User).first():
        return  # Already seeded

    # ── Create Users ────────────────────────────────────────────────────────
    users_data = [
        {"username": "admin",  "email": "admin@incidentiq.com",  "password": "admin123",  "role": UserRole.ADMIN},
        {"username": "david",  "email": "david@incidentiq.com",  "password": "tech123",   "role": UserRole.TECHNICIAN},
        {"username": "alice",  "email": "alice@incidentiq.com",  "password": "tech123",   "role": UserRole.TECHNICIAN},
        {"username": "sarah",  "email": "sarah@incidentiq.com",  "password": "emp123",    "role": UserRole.EMPLOYEE},
        {"username": "bob",    "email": "bob@incidentiq.com",    "password": "emp123",    "role": UserRole.EMPLOYEE},
        {"username": "carol",  "email": "carol@incidentiq.com",  "password": "emp123",    "role": UserRole.EMPLOYEE},
    ]

    created_users = {}
    for u in users_data:
        user = User(
            username=u["username"],
            email=u["email"],
            hashed_password=hash_password(u["password"]),
            role=u["role"],
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.flush()
        created_users[u["username"]] = user

    db.commit()

    # ── Create Sample Incidents ──────────────────────────────────────────────
    now = datetime.utcnow()

    # Incident 1: Critical payroll outage (P1) - IN_PROGRESS
    inc1 = Incident(
        title="Payroll System Down",
        description="The payroll system is completely down and crashing. Employees cannot access their payroll data. This is a critical production outage affecting all staff.",
        category=IncidentCategory.APPLICATION,
        priority=Priority.P1,
        status=IncidentStatus.IN_PROGRESS,
        created_by_id=created_users["sarah"].id,
        assigned_to_id=created_users["david"].id,
        ai_summary="Critical payroll application outage affecting all employees; immediate restoration required.",
        ai_category=IncidentCategory.APPLICATION,
        ai_priority=Priority.P1,
        ai_reasoning="Payroll system outage is critical business impact — P1.",
        ai_steps_json=json.dumps(["Check application server status", "Review error logs", "Restart payroll service", "Notify HR department"]),
        sla_deadline=now + timedelta(minutes=30),
        sla_violated=False,
        created_at=now - timedelta(hours=1),
        updated_at=now - timedelta(minutes=30),
    )
    db.add(inc1)
    db.flush()

    # Incident 2: Login access denied (P2) - ASSIGNED
    inc2 = Incident(
        title="Unable to Login to HR Portal",
        description="Several HR staff members are getting access denied when trying to login to the HR portal. The issue started this morning and is intermittent.",
        category=IncidentCategory.ACCESS,
        priority=Priority.P2,
        status=IncidentStatus.ASSIGNED,
        created_by_id=created_users["bob"].id,
        assigned_to_id=created_users["alice"].id,
        ai_summary="HR portal login issues affecting multiple staff; likely an authentication/access configuration problem.",
        ai_category=IncidentCategory.ACCESS,
        ai_priority=Priority.P2,
        ai_reasoning="Access denied to HR system is high impact business process disruption — P2.",
        ai_steps_json=json.dumps(["Verify LDAP/AD connectivity", "Check user permissions", "Review authentication logs", "Reset affected accounts if needed"]),
        sla_deadline=now + timedelta(minutes=120),
        sla_violated=False,
        created_at=now - timedelta(hours=2),
        updated_at=now - timedelta(hours=1),
    )
    db.add(inc2)
    db.flush()

    # Incident 3: Slow network (P3) - RESOLVED
    inc3 = Incident(
        title="Network Slowness in Building B",
        description="Users in Building B are experiencing slow network performance. File transfers are taking much longer than usual.",
        category=IncidentCategory.NETWORK,
        priority=Priority.P3,
        status=IncidentStatus.RESOLVED,
        created_by_id=created_users["carol"].id,
        assigned_to_id=created_users["david"].id,
        resolution_notes="Identified a faulty network switch in Building B floor 2. Replaced the switch and performance is restored.",
        ai_summary="Network performance degradation in Building B likely caused by hardware or congestion issues.",
        ai_category=IncidentCategory.NETWORK,
        ai_priority=Priority.P3,
        ai_reasoning="Network slowness with moderate impact — P3.",
        ai_steps_json=json.dumps(["Run network diagnostics", "Check switch/router logs", "Identify bottleneck", "Replace faulty hardware if needed"]),
        sla_deadline=now - timedelta(minutes=10),
        sla_violated=False,
        resolved_at=now - timedelta(hours=1),
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(hours=1),
    )
    db.add(inc3)
    db.flush()

    db.commit()

    # ── Audit Logs for sample incidents ─────────────────────────────────────
    audit_entries = [
        AuditLog(incident_id=inc1.id, action="INCIDENT_CREATED", actor_id=created_users["sarah"].id,
                 new_status=IncidentStatus.NEW, timestamp=now - timedelta(hours=1)),
        AuditLog(incident_id=inc1.id, action="AUTO_ASSIGNED", actor_id=created_users["sarah"].id,
                 old_status=IncidentStatus.NEW, new_status=IncidentStatus.ASSIGNED,
                 metadata_json=json.dumps({"assigned_to_id": created_users["david"].id}),
                 timestamp=now - timedelta(hours=1)),
        AuditLog(incident_id=inc1.id, action="STATUS_CHANGED", actor_id=created_users["david"].id,
                 old_status=IncidentStatus.ASSIGNED, new_status=IncidentStatus.IN_PROGRESS,
                 timestamp=now - timedelta(minutes=30)),

        AuditLog(incident_id=inc2.id, action="INCIDENT_CREATED", actor_id=created_users["bob"].id,
                 new_status=IncidentStatus.NEW, timestamp=now - timedelta(hours=2)),
        AuditLog(incident_id=inc2.id, action="AUTO_ASSIGNED", actor_id=created_users["bob"].id,
                 old_status=IncidentStatus.NEW, new_status=IncidentStatus.ASSIGNED,
                 metadata_json=json.dumps({"assigned_to_id": created_users["alice"].id}),
                 timestamp=now - timedelta(hours=2)),

        AuditLog(incident_id=inc3.id, action="INCIDENT_CREATED", actor_id=created_users["carol"].id,
                 new_status=IncidentStatus.NEW, timestamp=now - timedelta(days=1)),
        AuditLog(incident_id=inc3.id, action="AUTO_ASSIGNED", actor_id=created_users["carol"].id,
                 old_status=IncidentStatus.NEW, new_status=IncidentStatus.ASSIGNED,
                 metadata_json=json.dumps({"assigned_to_id": created_users["david"].id}),
                 timestamp=now - timedelta(days=1)),
        AuditLog(incident_id=inc3.id, action="STATUS_CHANGED", actor_id=created_users["david"].id,
                 old_status=IncidentStatus.ASSIGNED, new_status=IncidentStatus.IN_PROGRESS,
                 timestamp=now - timedelta(hours=5)),
        AuditLog(incident_id=inc3.id, action="STATUS_CHANGED", actor_id=created_users["david"].id,
                 old_status=IncidentStatus.IN_PROGRESS, new_status=IncidentStatus.RESOLVED,
                 timestamp=now - timedelta(hours=1)),
    ]
    for entry in audit_entries:
        db.add(entry)

    db.commit()
    print("✅ Database seeded with demo users and incidents.")
