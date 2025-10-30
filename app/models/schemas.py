from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20000, description="User prompt")

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
