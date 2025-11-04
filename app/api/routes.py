from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from ..services.tts_service import synth_to_file, list_voices

# --- storage: prefer Google Sheets, fall back to CSV if not configured ---
try:
    from ..storage import gsheet_store as store
    _STORE_NAME = "google_sheets"
except Exception:  # pragma: no cover
    from ..storage import csv_store as store
    _STORE_NAME = "csv"

from ..models.schemas import (
    BattleRequest,
    BattleResponse,
    ChatRequest,
    ChatResponse,
)
from ..services.chat_service import ChatService
from ..services.ollama_client import OllamaClient

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = BASE_DIR / "templates"

router = APIRouter()
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

service = ChatService()
client = OllamaClient()


def _log_safe(*args, **kwargs) -> None:
    """Log to the configured store without ever failing the API call."""
    try:
        store.log_row(*args, **kwargs)
    except Exception as e:  # pragma: no cover
        # Intentionally swallow logging errors to not affect the user flow.
        # You can 'print' or 'logger.warning' here if you’ve wired logging.
        print(f"[routes] logging skipped ({_STORE_NAME}): {e}")


# -----------------------------------------------------------------------------
# UI
# -----------------------------------------------------------------------------
@router.get("/", response_class=HTMLResponse, tags=["ui"])
def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


# -----------------------------------------------------------------------------
# Health / Utils
# -----------------------------------------------------------------------------
@router.get("/api/healthz", tags=["utils"])
def healthz() -> Dict[str, str]:
    try:
        models = client.list_models()
    except Exception:
        models = []
    return {
        "status": "ok",
        "store": _STORE_NAME,
        "models_seen": str(len(models)),
    }


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
@router.get("/api/models", tags=["models"])
def list_models() -> Dict[str, List[str]]:
    try:
        names = client.list_models()
        if not names:
            # Not an error per se; front-end can still render with empty list.
            return {"models": []}
        return {"models": names}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# -----------------------------------------------------------------------------
# Chat (single model)
# -----------------------------------------------------------------------------
@router.post(
    "/api/chat",
    response_model=ChatResponse,
    tags=["chat"],
    response_model_exclude_none=True,
)
def chat(req: ChatRequest) -> ChatResponse:
    try:
        # Allow front-end to omit 'model' → ChatService will use its default
        res = service.ask(req.prompt, model=getattr(req, "model", None))
        _log_safe(mode="single", prompt=req.prompt, response=res, slot="single")
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# -----------------------------------------------------------------------------
# Battle (two models)
# -----------------------------------------------------------------------------
@router.post(
    "/api/battle",
    response_model=BattleResponse,
    tags=["battle"],
    response_model_exclude_none=True,
)
def battle(req: BattleRequest):
    try:
        results = service.duel(req.prompt, req.model_a, req.model_b)

        # Group the two rows with the same pair_id so you can analyze later
        from uuid import uuid4

        pid = uuid4().hex[:12]
        if len(results) >= 1:
            _log_safe(
                mode="battle",
                prompt=req.prompt,
                response=results[0],
                slot="A",
                pair_id=pid,
            )
        if len(results) >= 2:
            _log_safe(
                mode="battle",
                prompt=req.prompt,
                response=results[1],
                slot="B",
                pair_id=pid,
            )

        return {"results": [r.model_dump() for r in results]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

# ---------- TTS models ----------
class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None
    rate: int | None = None       # e.g., 180
    volume: float | None = None   # 0.0 – 1.0

@router.get("/api/voices", tags=["tts"])
def voices():
    return {"voices": list_voices()}

@router.post("/api/tts", tags=["tts"])
def tts(req: TTSRequest):
    try:
        url = synth_to_file(req.text, req.voice_id, req.rate, req.volume)
        return {"audio_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# (Optional) CSV export if you’re using csv_store; uncomment if needed.
# -----------------------------------------------------------------------------
# from fastapi.responses import FileResponse
# from ..storage.csv_store import CSV_PATH
#
# @router.get("/api/logs.csv", tags=["utils"])
# def download_csv():
#     if not CSV_PATH.exists():
#         raise HTTPException(status_code=404, detail="No CSV yet")
#     return FileResponse(str(CSV_PATH), filename="llm_runs.csv", media_type="text/csv")
