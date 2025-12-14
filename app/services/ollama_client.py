import logging
import requests
from typing import Dict, Any, Optional
from ..core.config import settings

log = logging.getLogger(__name__)

class OllamaClient:
    """Thin HTTP client to call Ollama REST API."""
    def __init__(self, host: Optional[str] = None, default_model: Optional[str] = None):
        self.host = (host or settings.ollama_host).rstrip("/")
        self.default_model = default_model or settings.ollama_model
        self.chat_url = f"{self.host}/api/chat"
        self.tags_url = f"{self.host}/api/tags"

    def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
    ) -> Dict[str, Any]:
        payload = {
            "model": model or self.default_model,
            "stream": False,
            "options": {
                "temperature": settings.temperature if temperature is None else temperature,
                "top_p": settings.top_p if top_p is None else top_p,
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        log.info("Calling Ollama: %s", self.chat_url)
        r = requests.post(self.chat_url, json=payload, timeout=600)
        r.raise_for_status()
        return r.json()

    def list_models(self) -> list[str]:
        """Return installed model names from /api/tags."""
        r = requests.get(self.tags_url, timeout=30)
        r.raise_for_status()
        data = r.json()  # {"models":[{"name":"llama3.1:8b", ...}, ...]}
        return [m["name"] for m in data.get("models", []) if "name" in m]
