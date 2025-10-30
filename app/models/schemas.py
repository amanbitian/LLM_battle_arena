from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field

# ----- Single chat -----
class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20000)
    # Optional per-request override (e.g., "llama3.1:8b")
    model: Optional[str] = None

class ChatResponse(BaseModel):
    model: str
    content: str
    wall_time_sec: float
    total_time_sec: float
    load_time_sec: float
    prompt_eval_time_sec: float
    eval_time_sec: float
    prompt_tokens: int
    output_tokens: int
    tokens_per_sec_wall: float
    tokens_per_sec_generate: float
    raw_model_stats: Optional[dict] = None

# ----- Battle mode -----
class BattleRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20000)
    model_a: str
    model_b: str

class BattleResponse(BaseModel):
    results: List[ChatResponse]
