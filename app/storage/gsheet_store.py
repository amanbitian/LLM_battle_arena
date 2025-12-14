from __future__ import annotations

import os
import json
import base64
from datetime import datetime
from typing import Literal, Optional

import gspread
import backoff
from google.oauth2.service_account import Credentials

from ..models.schemas import ChatResponse

# === Config via env vars ===
#  GSPREAD_SA_JSON_B64 : base64 of your service-account JSON (recommended)
#  or GOOGLE_APPLICATION_CREDENTIALS : absolute path to that JSON file
#  GSPREAD_SHEET_ID    : spreadsheet id (the long string in the sheet URL)
#  GSPREAD_WORKSHEET   : worksheet/tab name (default: "runs")

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

_SHEET_ID = os.getenv("GSPREAD_SHEET_ID")
_WS_NAME = os.getenv("GSPREAD_WORKSHEET", "runs")

COLUMNS = [
    "ts_iso", "mode", "pair_id", "slot",
    "prompt", "model", "content",
    "wall_time_sec", "total_time_sec", "load_time_sec",
    "prompt_eval_time_sec", "eval_time_sec",
    "prompt_tokens", "output_tokens",
    "tokens_per_sec_wall", "tokens_per_sec_generate",
]

_client: gspread.Client | None = None
_ws: gspread.Worksheet | None = None


def _get_credentials() -> Credentials:
    b64 = os.getenv("GSPREAD_SA_JSON_B64")
    path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if b64:
        data = json.loads(base64.b64decode(b64).decode("utf-8"))
        return Credentials.from_service_account_info(data, scopes=_SCOPES)
    if path:
        return Credentials.from_service_account_file(path, scopes=_SCOPES)
    raise RuntimeError(
        "No credentials provided. Set GSPREAD_SA_JSON_B64 or GOOGLE_APPLICATION_CREDENTIALS."
    )


def _get_ws() -> gspread.Worksheet:
    global _client, _ws
    if _ws is not None:
        return _ws
    if not _SHEET_ID:
        raise RuntimeError("GSPREAD_SHEET_ID not set.")

    creds = _get_credentials()
    _client = gspread.authorize(creds)
    sh = _client.open_by_key(_SHEET_ID)

    # create or get worksheet
    try:
        ws = sh.worksheet(_WS_NAME)
    except gspread.exceptions.WorksheetNotFound:
        ws = sh.add_worksheet(title=_WS_NAME, rows=1000, cols=len(COLUMNS))

    # ensure header row
    header = ws.row_values(1)
    if header != COLUMNS:
        ws.clear()
        ws.update("A1", [COLUMNS])

    _ws = ws
    return _ws


@backoff.on_exception(backoff.expo, (gspread.exceptions.APIError,), max_time=60)
def _append(values: list[str]) -> None:
    ws = _get_ws()
    ws.append_rows([values], value_input_option="RAW", table_range="A1")


def log_row(
    *,
    mode: Literal["single", "battle"],
    prompt: str,
    response: ChatResponse,
    slot: Literal["single", "A", "B"] = "single",
    pair_id: Optional[str] = None,
) -> None:
    """
    Append one row (one model run) to Google Sheets.
    """
    ts = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    v = [
        ts,
        mode,
        pair_id or "",
        slot,
        prompt,
        response.model,
        response.content,
        str(response.wall_time_sec),
        str(response.total_time_sec),
        str(response.load_time_sec),
        str(response.prompt_eval_time_sec),
        str(response.eval_time_sec),
        str(response.prompt_tokens),
        str(response.output_tokens),
        str(response.tokens_per_sec_wall),
        str(response.tokens_per_sec_generate),
    ]
    _append(v)