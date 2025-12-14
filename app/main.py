from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .api.routes import router as api_router
from .core.config import settings
from .core.logging_config import configure_logging

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title=settings.app_name)
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.include_router(api_router)
    return app

app = create_app()
