import os
import time
import json
import requests
from datetime import timedelta

# ---------- Config ----------
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a helpful assistant.")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
TOP_P = float(os.getenv("TOP_P", "0.9"))
# ----------------------------

CHAT_URL = f"{OLLAMA_HOST}/api/chat"

def ns_to_s(ns: int) -> float:
    return ns / 1_000_000_000.0

def pretty_td(seconds: float) -> str:
    return str(timedelta(seconds=round(seconds, 3)))

def ask_once(user_prompt: str) -> None:
    """Send one chat turn (non-stream) and print response + metrics."""
    payload = {
        "model": MODEL,
        "stream": False,                # set True for streaming (you can adapt later)
        "options": {
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
        },
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_prompt},
        ],
    }

    # wall-clock timing (end-to-end)
    t0 = time.perf_counter()
    r = requests.post(CHAT_URL, json=payload, timeout=600)
    t1 = time.perf_counter()
    r.raise_for_status()

    data = r.json()
    msg = data.get("message", {}).get("content", "")
    model = data.get("model", MODEL)

    # Ollama returns detailed metrics in the top-level response
    # Keys typically available:
    #   total_duration, load_duration, prompt_eval_count, prompt_eval_duration,
    #   eval_count, eval_duration
    total_duration_ns = data.get("total_duration", 0)
    load_duration_ns = data.get("load_duration", 0)
    prompt_eval_count = data.get("prompt_eval_count", 0)
    prompt_eval_duration_ns = data.get("prompt_eval_duration", 0)
    eval_count = data.get("eval_count", 0)                # output tokens
    eval_duration_ns = data.get("eval_duration", 0)

    # Wall time (more intuitive than total_duration which excludes some overhead sometimes)
    wall_s = t1 - t0

    # Convert to seconds for readability
    total_s = ns_to_s(total_duration_ns)
    load_s = ns_to_s(load_duration_ns)
    prompt_eval_s = ns_to_s(prompt_eval_duration_ns)
    eval_s = ns_to_s(eval_duration_ns)

    # Throughput
    tps_wall = (eval_count / wall_s) if wall_s > 0 else 0.0
    tps_model = (eval_count / eval_s) if eval_s > 0 else 0.0

    print("\n=== RESPONSE ===\n")
    print(msg.strip())

    print("\n=== METRICS ===\n")
    print(f"Model:                 {model}")
    print(f"Wall time (end-to-end): {pretty_td(wall_s)}")
    print(f"Total (Ollama reported): {pretty_td(total_s)}")
    print(f"Load time:              {pretty_td(load_s)}")
    print(f"Prompt eval time:       {pretty_td(prompt_eval_s)}")
    print(f"Generate time:          {pretty_td(eval_s)}")
    print(f"Prompt tokens:          {prompt_eval_count}")
    print(f"Output tokens:          {eval_count}")
    print(f"Tokens/sec (wall):      {tps_wall:.2f}")
    print(f"Tokens/sec (generate):  {tps_model:.2f}")

    # If you want raw JSON for debugging, uncomment:
    # print("\nRAW JSON:\n", json.dumps(data, indent=2))

def main():
    print(f"🔧 Using model: {MODEL}")
    print("Type your prompt. Press Enter to send. Type 'exit' to quit.\n")
    while True:
        try:
            user_prompt = input(">>> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break
        if not user_prompt:
            continue
        if user_prompt.lower() in {"exit", "quit", ":q"}:
            print("Bye!")
            break
        ask_once(user_prompt)

if __name__ == "__main__":
    main()
