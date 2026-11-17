import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
from routers import auth, incidents, users, admin, ai, notifications
import seed

app = FastAPI(title="IncidentIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables
Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed.seed_if_empty(db)
    finally:
        db.close()


# Include routers
app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    return {"message": "IncidentIQ API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
