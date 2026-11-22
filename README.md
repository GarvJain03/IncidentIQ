# IncidentIQ - IT Incident Management System

A full-stack IT incident management system with AI-powered ticket analysis via the Gemini API.

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind CSS) |
| Backend | Python FastAPI + SQLAlchemy (PostgreSQL with SQLite fallback) |
| Database | PostgreSQL (Primary) / SQLite (Development Fallback) |
| Auth | JWT (python-jose + passlib bcrypt) |
| AI Feature | Google Gemini API (`gemini-4-hydrogen`) via `google-genai` |
| Charts | Recharts |

---

## Getting Started

### 1. Backend Setup

```bash
cd backend

# Copy env file and add your Gemini API key and PostgreSQL URL
cp .env.example .env
# Edit .env:
# GEMINI_API_KEY=your_actual_key
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/incidentiq

# Install dependencies (including PostgreSQL driver)
pip install -r requirements.txt

# Start the server (auto-seeds the database on first run)
uvicorn main:app --reload --port 8000
```

The API runs at **http://localhost:8000**  
Swagger docs: **http://localhost:8000/docs**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done if you cloned this repo)
npm install

# Run dev server
npm run dev
```

The app runs at **http://localhost:3000**

---

## Seed Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `david` | `tech123` | Technician |
| `alice` | `tech123` | Technician |
| `sarah` | `emp123` | Employee |
| `bob` | `emp123` | Employee |
| `carol` | `emp123` | Employee |

---

## Gemini AI Features

The app uses `gemini-4-hydrogen` via the **Interactions API** (`google-genai >= 3.2.0`):

### 1. Real-time Ticket Analysis (Employee → Report Incident)
As you type a description (after 600ms debounce), the app calls `POST /api/ai/analyze` and displays:
- **Auto-detected category** (APPLICATION / NETWORK / HARDWARE / ACCESS / OTHER)
- **Suggested priority** (P1–P4) with reasoning
- **Plain-English AI summary**
- **3–5 pre-generated resolution steps**

### 2. AI Resolution Tips (Technician → Ticket Detail)
When a technician opens an IN_PROGRESS ticket, they can click **"🤖 Get AI Resolution Tips"** to fetch context-aware resolution steps from Gemini on-demand.

> If `GEMINI_API_KEY` is not set, both features gracefully degrade with safe defaults — the app still works fully.

---

## Architecture

```
IncidentIQ/
├── backend/
│   ├── main.py                 # FastAPI app + startup seeding
│   ├── models.py               # SQLAlchemy ORM (User, Incident, AuditLog, Notification)
│   ├── schemas.py              # Pydantic v2 request/response schemas
│   ├── auth.py                 # JWT helpers + role-based deps
│   ├── seed.py                 # Database seeder
│   ├── routers/
│   │   ├── auth.py             # POST /api/auth/login|register, GET /me
│   │   ├── incidents.py        # Full CRUD + state machine + AI on create
│   │   ├── admin.py            # Stats + audit logs (Admin only)
│   │   ├── users.py            # User listing (Admin only)
│   │   ├── notifications.py    # User notifications
│   │   └── ai.py              # POST /api/ai/analyze|resolve-suggestions
│   └── services/
│       ├── gemini_service.py   # 🤖 Gemini API integration
│       ├── priority.py         # OOP: PriorityStrategy (Keyword-based)
│       ├── assignment.py       # OOP: AssignmentStrategy (Load-based)
│       ├── sla.py              # SLA deadline calculation
│       └── notification.py     # Notification helper
└── frontend/
    ├── app/
    │   ├── login/              # Login page
    │   ├── register/           # Register page
    │   ├── dashboard/          # Role-based redirect
    │   ├── employee/           # Employee dashboard + report form
    │   ├── technician/         # Technician queue + ticket detail
    │   └── admin/              # Admin dashboard + audit log
    ├── components/
    │   ├── AuthProvider.tsx     # Auth context
    │   ├── AiAnalysisPanel.tsx  # ✨ Gemini AI results display
    │   ├── SlaTimer.tsx         # Live SLA countdown
    │   ├── Badges.tsx           # StatusBadge + PriorityBadge
    │   └── Navbar.tsx
    └── lib/
        ├── api.ts              # Axios instance with JWT interceptor
        └── types.ts            # TypeScript interfaces
```

## Incident Lifecycle (State Machine)

```
NEW → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
```

Illegal transitions return HTTP 400. Role enforcement:
- **Employee**: can only create tickets and close (RESOLVED → CLOSED) their own
- **Technician**: can move ASSIGNED → IN_PROGRESS → RESOLVED on their assigned tickets
- **Admin**: can view everything

## ⏱ SLA Deadlines

| Priority | Deadline | Use Case |
|---|---|---|
| P1 | 30 minutes | Payroll, outage, security breach |
| P2 | 2 hours | Finance, billing, login issues |
| P3 | 8 hours | General application errors |
| P4 | 24 hours | Low-impact issues |
