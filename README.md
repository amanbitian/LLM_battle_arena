# Pratap LLM Battle Arena

<img width="1804" height="1896" alt="Screenshot 2025-12-15 004041" src="https://github.com/user-attachments/assets/b35567ee-3902-46e3-8e26-252f8828d14a" />
<img width="1472" height="1235" alt="image" src="https://github.com/user-attachments/assets/cb09abba-b97d-4fd2-bbb0-298918959daf" />
<img width="2921" height="1384" alt="Screenshot 2025-12-15 004211" src="https://github.com/user-attachments/assets/6a78dc72-d5cc-434b-b44c-69bca3cf5253" />

A lightweight **LLM benchmarking and comparison framework** that allows you to compare **two open-source LLMs side-by-side**, evaluate their responses on the same prompt, and **automatically log responses and performance metrics to Google Sheets**.

This project is designed for:
- Comparing reasoning and mathematics capability
- Latency and throughput benchmarking
- Local LLM experimentation using Ollama
- Data-driven model selection before fine-tuning or deployment

---

## Features

- 🔁 **Battle Arena Mode** – Compare two models on the same prompt
- 🧠 **Model-agnostic** – Works with any Ollama-served model
- 📊 **Automatic Google Sheets logging**
- 🔊 **Text-to-Speech (TTS) Support**
- ⏱️ **Latency, load time, and generation metrics**
- 🔢 **Token usage and throughput tracking**
- 🌐 **Simple local Web UI**
- 🧪 **Clean dev → test → main branching strategy**

---

# Details


A local, lightweight **LLM comparison playground** that lets you run the **same prompt** against **two Ollama models** (Model A vs Model B), view responses side-by-side, and **automatically log prompts + responses + performance metrics to Google Sheets** for analysis.

It also includes **Text-to-Speech (TTS)** so you can listen to model outputs from the UI.

---

## What this repo does

- **Single mode**: run one prompt against one model (`/api/chat`)
- **Battle mode**: run the same prompt against two models (`/api/battle`)
- **Metrics**: captures latency and token stats returned by Ollama (`total_duration`, `eval_duration`, token counts)
- **Logging**: appends one row per run into **Google Sheets** (preferred), with CSV fallback if Sheets is not configured
- **TTS**:
  - Default: **browser SpeechSynthesis** (no server load)
  - Optional: **server-side TTS** endpoint that generates an audio file under `/static/audio`

---

## System design

<img width="2400" height="1400" alt="system_design" src="https://github.com/user-attachments/assets/8593e377-cf5b-4db7-8f24-216ebf69a702" />

---

## Tech stack

- **FastAPI** backend
- **Jinja2** templates + static JS/CSS UI
- **Ollama** for model inference (`/api/chat`, `/api/tags`)
- **Google Sheets** logging via `gspread` + Google service account
- Optional server TTS: macOS `say` (preferred) → fallback `pyttsx3`

---

## Branching strategy

This repo uses a simple 3-branch workflow:

- `dev` – active development (new features)
- `test` – testing and bug-fixing
- `main` – stable / production-ready

Suggested workflow:
1. Build features in `dev`
2. Merge to `test` for validation
3. Promote to `main` when stable

---

## Project layout

```
app/
  main.py                  # FastAPI app factory
  api/routes.py            # UI + API endpoints
  core/config.py           # .env + runtime settings
  services/
    ollama_client.py       # HTTP client for Ollama
    chat_service.py        # ask() + duel() logic + metrics normalization
    tts_service.py         # optional server-side TTS → /static/audio
    timing.py              # nanoseconds → seconds helpers
  storage/
    gsheet_store.py        # Google Sheets logger (preferred)
    csv_store.py           # CSV logger fallback
  templates/index.html     # UI
  static/js/app.js         # UI logic + battle + optional TTS
  static/css/styles.css
```

---

## API endpoints

- `GET /` – Web UI
- `GET /api/healthz` – health check
- `GET /api/models` – lists locally installed Ollama models (via `/api/tags`)
- `POST /api/chat` – single model inference
- `POST /api/battle` – two-model duel inference
- `GET /api/voices` – available server-side voices (macOS `say -v ?`)
- `POST /api/tts` – optional server-side TTS → returns `audio_url`
- `GET /api/logs.csv` – CSV download (only when CSV store is enabled)

---

## Setup

### 1) Prerequisites

- Python 3.10+ (recommended)
- Ollama installed and running
- At least one Ollama model pulled locally

Example:
```bash
ollama pull llama3.1:8b
ollama pull qwen3:8b
```

### 2) Install

```bash
pip install -r requirements.txt
```

### 3) Configure environment

Create a `.env` file in the project root (optional but recommended):

```env
# App
APP_NAME=Pratap LLM Battle Arena
APP_ENV=local

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
TEMPERATURE=0.7
TOP_P=0.9

# Google Sheets logging (recommended)
GSPREAD_SHEET_ID=YOUR_SHEET_ID
GSPREAD_WORKSHEET=runs
# Provide one of the following:
# (A) base64 of service-account json:
GSPREAD_SA_JSON_B64=...
# OR (B) path to service-account json:
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service_account.json
```

**Google Sheets logger configuration (how it works)**
- The app prefers **Google Sheets** if `GSPREAD_SHEET_ID` + credentials are present.
- Credentials can be provided by:
  - `GSPREAD_SA_JSON_B64` (recommended for servers/CI)
  - `GOOGLE_APPLICATION_CREDENTIALS` (local dev)
- Worksheet name defaults to `runs` if not specified.

### 4) Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:
- http://localhost:8000

---

## Using the Battle Arena UI

1. Choose **Mode**: Single or Battle Arena
2. Select model(s)
3. Enter a prompt
4. Click **Send**
5. Inspect:
   - Response text
   - Metrics (latency + tokens + throughput)
6. Open Google Sheets to analyze historical runs

---

## Text-to-Speech (TTS)

### Default (recommended): browser TTS
The UI uses the browser’s SpeechSynthesis by default:
- No server compute
- Works on most modern browsers

This is controlled in:
`app/static/js/app.js`
```js
const USE_SERVER_TTS = false;
```

### Optional: server-side TTS
If you set:
```js
const USE_SERVER_TTS = true;
```
the UI will call:
- `POST /api/tts` with `{ "text": "..." }`
and receive:
- `{ "audio_url": "/static/audio/<id>.aiff" }`

Server-side TTS implementation:
- macOS `say` → generates `.aiff` under `app/static/audio/`
- fallback: `pyttsx3`

Note: server-side TTS is most reliable on macOS due to the `say` dependency.

---

## Metrics notes (how numbers are computed)

The backend uses Ollama’s returned stats (nanoseconds + token counters) and normalizes them into seconds:

- `total_time_sec` from `total_duration`
- `load_time_sec` from `load_duration`
- `prompt_eval_time_sec` from `prompt_eval_duration`
- `eval_time_sec` from `eval_duration`
- `prompt_tokens` from `prompt_eval_count`
- `output_tokens` from `eval_count`
- `tokens_per_sec_wall` = output_tokens / wall_time
- `tokens_per_sec_generate` = output_tokens / eval_time

---

## Troubleshooting

### `/api/models` returns empty
- Ensure Ollama is running: `ollama ps`
- Ensure you pulled at least one model: `ollama pull llama3.1:8b`
- Confirm `OLLAMA_HOST` is correct

### Google Sheets logging not working
- Verify `GSPREAD_SHEET_ID` and credentials env vars
- Confirm the service account has access to the sheet (Share the sheet with the service account email)

### Battle is slow
- Some models offload partially to CPU (hybrid CPU/GPU). Check:
  - `ollama ps`
  - `nvidia-smi` (for NVIDIA GPUs)


