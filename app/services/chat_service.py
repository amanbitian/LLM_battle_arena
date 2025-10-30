import time
from .ollama_client import OllamaClient
from .timing import ns_to_s
from ..models.schemas import ChatResponse
from ..core.config import settings

SYSTEM_PROMPT = (
    "You are a professional assistant. "
    "Be concise, correct, and helpful. When relevant, show numbered steps. "
)

class ChatService:
    """Business logic for chatting + extracting metrics."""
    def __init__(self, client: OllamaClient | None = None):
        self.client = client or OllamaClient()

    def ask(self, prompt: str) -> ChatResponse:
        t0 = time.perf_counter()
        data = self.client.chat(SYSTEM_PROMPT, prompt)
        t1 = time.perf_counter()

        msg = data.get("message", {}).get("content", "")
        model = data.get("model", settings.ollama_model)

        total_s = ns_to_s(data.get("total_duration", 0))
        load_s = ns_to_s(data.get("load_duration", 0))
        prompt_eval_s = ns_to_s(data.get("prompt_eval_duration", 0))
        eval_s = ns_to_s(data.get("eval_duration", 0))
        p_count = int(data.get("prompt_eval_count", 0))
        o_count = int(data.get("eval_count", 0))

        wall_s = t1 - t0
        tps_wall = (o_count / wall_s) if wall_s > 0 else 0.0
        tps_model = (o_count / eval_s) if eval_s > 0 else 0.0

        return ChatResponse(
            model=model,
            content=msg.strip(),
            wall_time_sec=round(wall_s, 3),
            total_time_sec=round(total_s, 3),
            load_time_sec=round(load_s, 3),
            prompt_eval_time_sec=round(prompt_eval_s, 3),
            eval_time_sec=round(eval_s, 3),
            prompt_tokens=p_count,
            output_tokens=o_count,
            tokens_per_sec_wall=round(tps_wall, 2),
            tokens_per_sec_generate=round(tps_model, 2),
            raw_model_stats={
                k: v for k, v in data.items()
                if k in {"total_duration","load_duration","prompt_eval_duration","eval_duration",
                         "prompt_eval_count","eval_count"}
            },
        )
