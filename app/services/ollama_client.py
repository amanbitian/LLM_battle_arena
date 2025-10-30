import logging
import requests
from typing import Dict, Any
from ..core.config import settings

log = logging.getLogger(__name__)

class OllamaClient:
    """Thin HTTP client to call Ollama's /api/chat."""
    def __init__(self, host: str | None = None, model: str | None = None):
        self.host = (host or settings.ollama_host).rstrip("/")
        self.model = model or settings.ollama_model
        self.url = f"{self.host}/api/chat"

    def chat(self, system_prompt: str, user_prompt: str,
             temperature: float | None = None, top_p: float | None = None) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else settings.temperature,
                "top_p": top_p if top_p is not None else settings.top_p,
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        log.info("Calling Ollama: %s", self.url)
        r = requests.post(self.url, json=payload, timeout=600)
        r.raise_for_status()
        return r.json()
