# app/services/tts_service.py
from __future__ import annotations
import uuid
import threading
import subprocess
from pathlib import Path
from typing import Optional

AUDIO_DIR = Path(__file__).resolve().parents[1] / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

_lock = threading.Lock()

def _mac_say(text: str, voice: Optional[str], out_path: Path):
    """
    Use macOS 'say' to synthesize audio. Produces AIFF or CAF (Safari/Chrome can play AIFF).
    """
    # Build command: say -o file.aiff --data-format=LEI16@22050 -v "Samantha" "Hello"
    cmd = ["say", "-o", str(out_path), "--data-format=LEI16@22050"]
    if voice:
        cmd.extend(["-v", voice])
    cmd.append(text)
    subprocess.run(cmd, check=True)

def synth_to_file(
    text: str,
    voice_id: Optional[str] = None,   # macOS voice name, e.g. "Samantha", "Alex"
    rate: Optional[int] = None,       # ignored by 'say' (can embed in text if needed)
    volume: Optional[float] = None,   # ignored by 'say'
) -> str:
    """
    Synthesize to an AIFF file and return the /static URL.
    Falls back to pyttsx3 only if 'say' isn't available.
    """
    if not text or not text.strip():
        raise ValueError("Empty text")

    file_name = f"{uuid.uuid4().hex}.aiff"
    out_path = AUDIO_DIR / file_name

    # Try macOS 'say' first (most reliable on Mac)
    try:
        with _lock:
            _mac_say(text, voice_id, out_path)
        return f"/static/audio/{file_name}"
    except Exception as say_err:
        # Fallback: pyttsx3 (may work, but less reliable with save_to_file on macOS)
        try:
            import pyttsx3
            engine = pyttsx3.init()
            if voice_id:
                engine.setProperty("voice", voice_id)
            if rate is not None:
                engine.setProperty("rate", int(rate))
            if volume is not None:
                engine.setProperty("volume", float(volume))
            engine.save_to_file(text, str(out_path))
            engine.runAndWait()
            return f"/static/audio/{file_name}"
        except Exception as e:
            raise RuntimeError(f"TTS failed (say + pyttsx3): {e}; first error: {say_err}") from e

def list_voices() -> list[dict]:
    """
    Return available macOS voices via 'say -v ?'.
    """
    try:
        out = subprocess.check_output(["say", "-v", "?"], text=True)
        voices = []
        for line in out.splitlines():
            # format: "Samantha en_US    # Description..."
            parts = line.split("#")[0].strip().split()
            if parts:
                name = parts[0]
                voices.append({"id": name, "name": name})
        return voices
    except Exception:
        # Fallback empty list if 'say' not available
        return []
