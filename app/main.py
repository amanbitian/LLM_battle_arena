from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .core.logging_config import configure_logging
from .api.routes import router as api_router

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"       # app/static
TEMPLATES_DIR = BASE_DIR / "templates" # app/templates

def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title=settings.app_name)

    # Mount static only if the dir exists (prevents boot crash)
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    else:
        import logging
        logging.getLogger(__name__).warning("Static dir missing: %s", STATIC_DIR)

    app.include_router(api_router)
    return app

app = create_app()
