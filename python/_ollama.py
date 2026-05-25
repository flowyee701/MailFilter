"""Tiny Ollama HTTP client wrapper."""
from __future__ import annotations

import json
from typing import Any

import requests


def generate(
    *,
    base_url: str,
    model: str,
    prompt: str,
    system: str | None = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    timeout: int = 120,
    num_predict: int | None = None,
    keep_alive: str = "10m",
) -> str:
    """Call POST /api/generate with stream=false and return the response text.

    Ollama returns JSON: { "response": "...", ... }

    `num_predict` caps response tokens (huge speed win for tiny outputs like JSON).
    `keep_alive` keeps the model loaded in VRAM between calls — without it Ollama
    unloads after 5 min and the next call eats the cold-start cost.
    """
    url = base_url.rstrip("/") + "/api/generate"
    options: dict[str, Any] = {"temperature": temperature}
    if num_predict is not None:
        options["num_predict"] = num_predict
    body: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": options,
        "keep_alive": keep_alive,
    }
    if system:
        body["system"] = system
    if json_mode:
        body["format"] = "json"

    r = requests.post(url, json=body, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    return (data.get("response") or "").strip()


def parse_json_block(text: str) -> dict[str, Any] | None:
    """Models sometimes wrap JSON in prose or markdown fences. Extract the first object."""
    text = text.strip()
    if text.startswith("```"):
        # Strip fences.
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    # Try direct parse first.
    try:
        return json.loads(text)
    except Exception:
        pass
    # Find first { ... } block.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    return None
