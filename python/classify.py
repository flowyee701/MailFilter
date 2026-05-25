"""Classify a single email into one of four categories using Ollama.

Input JSON:
  { "ollama_url": str, "model": str,
    "subject": str, "from": str, "snippet": str, "body": str,
    "examples": [ {subject, snippet, from, category}, ... ] }

Output JSON:
  { "category": "reply"|"important"|"event"|"noise", "confidence": 0..1 }
"""
import re

from mm_io import read_payload, write_result, fail
from _ollama import generate, parse_json_block

CATEGORIES = ("reply", "important", "event", "noise")

# --- Heuristic pre-filter ---------------------------------------------------
# Skip the LLM entirely for obvious automated / marketing mail. This is the
# single biggest perf win: 30–60% of corporate inboxes are clearly-noise and
# Mistral takes 2–10s per email on Apple Silicon.
NOISE_FROM_PATTERNS = [
    re.compile(p, re.I) for p in [
        r"\bno[-_.]?reply\b", r"\bdo[-_.]?not[-_.]?reply\b",
        r"\bdonotreply\b", r"\bnoreply\b",
        r"\bnotifications?@", r"\bnotify@", r"\balerts?@",
        r"\bnews(letter)?@", r"\bmarketing@", r"\bpromo@", r"\bpromotions?@",
        r"\bmailer[-_.]?daemon\b", r"\bbounce[s]?@", r"\bpostmaster@",
        r"@.*atlassian\.(com|net)$",   # JIRA / Confluence / Trello
        r"\bjira@", r"\bconfluence@",
        r"@.*\.facebookmail\.com$",
        r"@.*\.linkedin\.com$", r"@email\.medium\.com$",
        r"@.*\.substack\.com$", r"@.*mailchimp\.com$", r"@.*sendgrid\.net$",
    ]
]
NOISE_SUBJECT_PATTERNS = [
    re.compile(p, re.I) for p in [
        r"\bunsubscribe\b", r"\bnewsletter\b", r"\bweekly digest\b",
        r"\bspecial offer\b", r"\bdiscount\b", r"% off",
        r"\bsale ends\b", r"\bblack friday\b", r"\bcyber monday\b",
        r"\bdaily digest\b", r"\byou have \d+ new\b",
        r"\[(jira|confluence|gitlab|github)\]", r"\bbuild (passed|failed|succeeded)\b",
    ]
]


def heuristic_noise(from_addr: str, subject: str) -> bool:
    s = f"{from_addr} {subject}"
    for r in NOISE_FROM_PATTERNS:
        if r.search(from_addr or ""):
            return True
    for r in NOISE_SUBJECT_PATTERNS:
        if r.search(subject or ""):
            return True
    # Bonus: any email containing an unsubscribe-style List-Unsubscribe phrasing
    # tucked into the snippet — that's a near-perfect noise signal.
    return False


# --- LLM prompt -------------------------------------------------------------
SYSTEM = """Email triage. Classify each email into EXACTLY ONE category:

reply     — a person waits for the user's answer (questions, requests, decisions, follow-ups)
important — reports, company news, status updates, deliverables (informational, worth reading)
event     — meeting invites, calendar events, webinars, RSVPs
noise     — newsletters, ads, automated notifications, marketing, receipts

If unsure between important and noise, pick noise.
Reply with ONLY a JSON object, nothing else."""


def build_prompt(payload: dict) -> str:
    examples = payload.get("examples") or []
    parts = []
    if examples:
        parts.append("Past user corrections (learn from these):")
        for ex in examples[:8]:  # was 12 — fewer = shorter prompt
            parts.append(
                f"- from={ex.get('from','')[:60]} | "
                f"subj={ex.get('subject','')[:80]} "
                f"-> {ex.get('category','noise')}"
            )
        parts.append("")

    # Snippet is usually enough. Only fall back to a tiny body slice if snippet is empty.
    body_excerpt = (
        payload.get("snippet")
        or (payload.get("body") or "")[:500]
    )[:600]  # was 2000 — big token reduction
    parts.append("Classify this email:")
    parts.append(f"from: {payload.get('from','')[:80]}")
    parts.append(f"subject: {payload.get('subject','')[:120]}")
    parts.append(f"body: {body_excerpt}")
    parts.append('JSON: {"category":"reply|important|event|noise","confidence":0..1}')
    return "\n".join(parts)


def main() -> None:
    p = read_payload()
    if not p.get("ollama_url") or not p.get("model"):
        fail("missing ollama_url or model")
        return

    # Cheap fast path: regex says "obviously noise" → don't even open Ollama.
    if heuristic_noise(p.get("from", ""), p.get("subject", "")):
        write_result({"category": "noise", "confidence": 0.92})
        return

    try:
        resp = generate(
            base_url=p["ollama_url"],
            model=p["model"],
            system=SYSTEM,
            prompt=build_prompt(p),
            json_mode=True,
            temperature=0.0,       # deterministic, slightly faster
            num_predict=80,        # response is ~30 tokens, cap is generous
            keep_alive="10m",      # keep model in VRAM between sync calls
            timeout=60,
        )
    except Exception as e:
        fail(f"ollama call failed: {e}", e)
        return

    parsed = parse_json_block(resp) or {}
    cat = str(parsed.get("category", "noise")).lower().strip()
    if cat not in CATEGORIES:
        cat = "noise"
    try:
        conf = float(parsed.get("confidence", 0.5))
    except Exception:
        conf = 0.5
    conf = max(0.0, min(1.0, conf))
    write_result({"category": cat, "confidence": conf})


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:
        fail(f"unhandled: {e}", e)
