# app/services/tts_service.py
from __future__ import annotations

import uuid
import threading
from pathlib import Path
from typing import Optional

import pyttsx3

AUDIO_DIR = Path(__file__).resolve().parents[1] / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# pyttsx3 engine is not thread-safe across init/teardown cycles.
# Keep a single engine and guard synth with a lock.
_engine = pyttsx3.init()
_lock = threading.Lock()

# macOS (NSSpeechSynthesizer) saves AIFF by default. Use .aiff for max reliability.
# Browsers can play .aiff; if you prefer .wav, you can convert with pydub/ffmpeg later.
DEFAULT_EXT = ".aiff"


def list_voices() -> list[dict]:
    """Return available voices (id + name) so you can surface a dropdown later."""
    voices = []
    for v in _engine.getProperty("voices"):
        voices.append({"id": v.id, "name": getattr(v, "name", v.id)})
    return voices


def synth_to_file(
    text: str,
    voice_id: Optional[str] = None,
    rate: Optional[int] = None,
    volume: Optional[float] = None,
) -> str:
    """
    Synthesize speech and return a public URL path like /static/audio/<file>.aiff
    """
    if not text or not text.strip():
        raise ValueError("Empty text")

    file_name = f"{uuid.uuid4().hex}{DEFAULT_EXT}"
    out_path = AUDIO_DIR / file_name

    with _lock:
        if voice_id:
            _engine.setProperty("voice", voice_id)
        if rate is not None:
            _engine.setProperty("rate", int(rate))       # typical range 150–200
        if volume is not None:
            _engine.setProperty("volume", float(volume)) # 0.0–1.0

        _engine.save_to_file(text, str(out_path))
        _engine.runAndWait()

    # URL that your StaticFiles mount serves
    return f"/static/audio/{file_name}"
