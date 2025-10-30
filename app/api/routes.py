from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from ..models.schemas import BattleRequest, BattleResponse, ChatRequest, ChatResponse
from ..services.chat_service import ChatService
from ..services.ollama_client import OllamaClient

BASE_DIR = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = BASE_DIR / "templates"

router = APIRouter()
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

service = ChatService()
client = OllamaClient()

@router.get("/", response_class=HTMLResponse, tags=["ui"])
def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/api/healthz", tags=["utils"])
def healthz() -> Dict[str, str]:
    return {"status": "ok"}

@router.get("/api/models", tags=["models"])
def list_models() -> Dict[str, List[str]]:
    try:
        return {"models": client.list_models()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.post("/api/chat", response_model=ChatResponse, tags=["chat"], response_model_exclude_none=True)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        return service.ask(req.prompt, model=req.model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.post("/api/battle", response_model=BattleResponse, tags=["battle"], response_model_exclude_none=True)
def battle(req: BattleRequest):
    try:
        results = service.duel(req.prompt, req.model_a, req.model_b)
        return {"results": [r.model_dump() for r in results]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
