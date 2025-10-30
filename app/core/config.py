from pydantic import BaseModel, Field
from dotenv import load_dotenv
import os

load_dotenv()  # loads .env if present

class Settings(BaseModel):
    app_name: str = Field(default=os.getenv("APP_NAME", "Ollama Web Bench"))
    app_env: str = Field(default=os.getenv("APP_ENV", "local"))
    ollama_host: str = Field(default=os.getenv("OLLAMA_HOST", "http://localhost:11434"))
    ollama_model: str = Field(default=os.getenv("OLLAMA_MODEL", "llama3.1:8b"))
    temperature: float = Field(default=float(os.getenv("TEMPERATURE", "0.7")))
    top_p: float = Field(default=float(os.getenv("TOP_P", "0.9")))

settings = Settings()
