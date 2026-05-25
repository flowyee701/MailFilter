"""Generate a draft reply for an email that requires a response.

Input JSON:
  { "ollama_url": str, "model": str,
    "subject": str, "from": str, "body": str }

Output JSON:
  { "draft": str }
"""
from __future__ import annotations

from mm_io import read_payload, write_result, fail
from _ollama import generate

SYSTEM = """You are an assistant drafting concise, professional email replies on behalf of the user.

Rules:
- Match the language of the incoming email (Russian -> Russian, English -> English).
- Match the formality of the incoming email.
- Be brief: 2-4 short paragraphs at most.
- If the sender asked a question, answer it or acknowledge and propose next steps.
- If a meeting is proposed, suggest accepting and ask for any missing details.
- Sign off with "Best regards," followed by a placeholder "[Your name]".
- Do NOT include the subject line or quoted original message.
- Output ONLY the reply body text — no preamble, no explanations, no markdown."""


def main() -> None:
    p = read_payload()
    if not p.get("ollama_url") or not p.get("model"):
        fail("missing ollama_url or model")
        return

    prompt = (
        f"From: {p.get('from','')}\n"
        f"Subject: {p.get('subject','')}\n\n"
        f"Original message:\n{(p.get('body') or '')[:4000]}\n\n"
        "Draft a reply now."
    )
    try:
        resp = generate(
            base_url=p["ollama_url"],
            model=p["model"],
            system=SYSTEM,
            prompt=prompt,
            temperature=0.4,
        )
    except Exception as e:
        fail(f"ollama call failed: {e}", e)
        return
    write_result({"draft": resp})


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:
        fail(f"unhandled: {e}", e)
