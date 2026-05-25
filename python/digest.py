"""Generate a morning digest summarizing the last 24h of mail.

Input JSON:
  { "ollama_url": str, "model": str,
    "items": [ { subject, from, snippet, category }, ... ] }

Output JSON:
  { "digest": str }
"""
from __future__ import annotations

from mm_io import read_payload, write_result, fail
from _ollama import generate

SYSTEM = """You write concise daily email digests for a busy professional.

Structure:
  ## Needs your reply (N)
  - one-line summary per email (who + what they want)

  ## Important (N)
  - one-line summary per email

  ## Events (N)
  - one-line summary per email (include date/time if visible)

  ## Noise (N)
  Just the count — do not list items.

Rules:
- Skip sections that have zero items (except always show Noise count if > 0).
- Keep each bullet to one line, under 100 chars.
- Match the language of the majority of emails."""


def main() -> None:
    p = read_payload()
    items = p.get("items") or []
    if not p.get("ollama_url") or not p.get("model"):
        fail("missing ollama_url or model")
        return

    if not items:
        write_result({"digest": "No new mail in the last 24 hours."})
        return

    # Group by category for the prompt; cap noise items to save context.
    groups: dict[str, list[dict]] = {"reply": [], "important": [], "event": [], "noise": []}
    for it in items:
        cat = it.get("category", "noise")
        if cat in groups:
            groups[cat].append(it)

    lines = []
    for cat, label in (("reply", "Needs reply"), ("important", "Important"),
                       ("event", "Events"), ("noise", "Noise")):
        if not groups[cat]:
            continue
        lines.append(f"\n[{label}] — {len(groups[cat])} email(s)")
        sample = groups[cat] if cat != "noise" else groups[cat][:5]
        for it in sample:
            lines.append(
                f"- from: {it.get('from','')}\n"
                f"  subject: {it.get('subject','')}\n"
                f"  snippet: {(it.get('snippet','') or '')[:200]}"
            )

    prompt = "Here are the emails from the last 24h:\n" + "\n".join(lines) + "\n\nWrite the digest now."

    try:
        resp = generate(
            base_url=p["ollama_url"],
            model=p["model"],
            system=SYSTEM,
            prompt=prompt,
            temperature=0.3,
            timeout=180,
        )
    except Exception as e:
        fail(f"ollama call failed: {e}", e)
        return
    write_result({"digest": resp})


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:
        fail(f"unhandled: {e}", e)
