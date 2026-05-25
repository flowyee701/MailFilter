"""Shared helpers for reading a JSON payload from stdin and writing a single JSON result to stdout.

The Rust side talks to each python script via:
  - stdin: one JSON object
  - stdout: one JSON object (the only thing printed)
  - stderr: free-form logging
"""
from __future__ import annotations

import json
import sys
import traceback
from typing import Any


def read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def write_result(obj: Any) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))
    sys.stdout.flush()


def fail(message: str, exc: BaseException | None = None) -> None:
    if exc is not None:
        traceback.print_exc(file=sys.stderr)
    write_result({"ok": False, "error": message})
    sys.exit(0)  # exit 0 — Rust reads ok flag, not exit code
