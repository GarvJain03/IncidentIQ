from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import get_current_user
from models import User
from services.gemini_service import analyze_incident, get_resolution_suggestions

router = APIRouter(prefix="/api/ai", tags=["AI"])


class AnalyzeRequest(BaseModel):
    title: str = ""
    description: str


class ResolveSuggestRequest(BaseModel):
    title: str
    description: str
    category: str


@router.post("/analyze")
async def analyze(req: AnalyzeRequest, current_user: User = Depends(get_current_user)):
    return await analyze_incident(req.title, req.description)


@router.post("/resolve-suggestions")
async def resolve_suggestions(req: ResolveSuggestRequest, current_user: User = Depends(get_current_user)):
    steps = await get_resolution_suggestions(req.title, req.description, req.category)
    return {"steps": steps}
