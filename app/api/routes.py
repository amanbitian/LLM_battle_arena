from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from ..models.schemas import ChatRequest, ChatResponse
from ..services.chat_service import ChatService

BASE_DIR = Path(__file__).resolve().parents[1]    # .../app
TEMPLATES_DIR = BASE_DIR / "templates"

router = APIRouter()
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
service = ChatService()

@router.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@router.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        return service.ask(req.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
