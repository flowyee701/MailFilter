"""IMAP fetcher.

Input JSON:
  { "host": str, "port": int, "login": str, "password": str,
    "mailbox": str = "INBOX", "limit": int = 50, "test": bool = false }

Output JSON:
  { "ok": bool, "error"?: str, "emails": [ FetchedEmail, ... ] }
"""
from __future__ import annotations

import email
import email.policy
import email.utils
import imaplib
import re
import sys
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.message import Message
from typing import Any

from mm_io import read_payload, write_result, fail

MAX_BODY_CHARS = 20_000
SNIPPET_CHARS = 280


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _extract_body(msg: Message) -> str:
    if msg.is_multipart():
        # Prefer text/plain, fall back to text/html stripped.
        text_part = None
        html_part = None
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disp:
                continue
            if ctype == "text/plain" and text_part is None:
                text_part = part
            elif ctype == "text/html" and html_part is None:
                html_part = part
        chosen = text_part or html_part
        if chosen is None:
            return ""
        payload = chosen.get_content()
    else:
        payload = msg.get_content() if msg.get_content_maintype() == "text" else ""

    if not isinstance(payload, str):
        try:
            payload = payload.decode("utf-8", errors="replace")
        except Exception:
            payload = str(payload)

    # Strip HTML tags crudely if needed.
    if "<" in payload and ">" in payload:
        payload = re.sub(r"<style[\s\S]*?</style>", " ", payload, flags=re.I)
        payload = re.sub(r"<script[\s\S]*?</script>", " ", payload, flags=re.I)
        payload = re.sub(r"<[^>]+>", " ", payload)
        payload = re.sub(r"&nbsp;", " ", payload)
        payload = re.sub(r"&amp;", "&", payload)

    payload = re.sub(r"[ \t]+", " ", payload)
    payload = re.sub(r"\n{3,}", "\n\n", payload).strip()
    return payload[:MAX_BODY_CHARS]


def _snippet(body: str) -> str:
    one_line = re.sub(r"\s+", " ", body).strip()
    return one_line[:SNIPPET_CHARS]


def _parse_addr(raw: str) -> tuple[str, str]:
    name, addr = email.utils.parseaddr(raw or "")
    return _decode(name), addr


def _parse_date(raw: str | None) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = email.utils.parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def main() -> None:
    p = read_payload()
    host = p.get("host") or ""
    port = int(p.get("port") or 993)
    login = p.get("login") or ""
    password = p.get("password") or ""
    mailbox = p.get("mailbox") or "INBOX"
    limit = int(p.get("limit") or 50)
    is_test = bool(p.get("test"))

    if not host or not login or not password:
        fail("Missing host/login/password")
        return

    try:
        conn = imaplib.IMAP4_SSL(host, port)
    except Exception as e:
        fail(f"Cannot connect to {host}:{port}: {e}", e)
        return

    try:
        conn.login(login, password)
    except imaplib.IMAP4.error as e:
        fail(f"IMAP login failed: {e}", e)
        return

    if is_test:
        try:
            conn.logout()
        except Exception:
            pass
        write_result({"ok": True})
        return

    try:
        typ, _ = conn.select(mailbox, readonly=True)
        if typ != "OK":
            fail(f"Cannot select mailbox {mailbox}")
            return

        # Always fetch the latest `limit` messages by UID, regardless of read state.
        # (UIDs grow monotonically, so the tail is the newest.)
        typ, data = conn.search(None, "ALL")
        if typ != "OK":
            fail("IMAP search failed")
            return
        uids = data[0].split()
        uids = uids[-limit:]

        out: list[dict[str, Any]] = []
        for raw_uid in reversed(uids):
            uid = raw_uid.decode()
            typ, msg_data = conn.fetch(raw_uid, "(RFC822)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue
            raw_msg = msg_data[0][1]
            try:
                msg = email.message_from_bytes(raw_msg, policy=email.policy.default)
            except Exception as e:
                print(f"parse fail {uid}: {e}", file=sys.stderr)
                continue

            from_name, from_addr = _parse_addr(msg.get("From", ""))
            _, to_addr = _parse_addr(msg.get("To", ""))
            subject = _decode(msg.get("Subject", "")) or "(no subject)"
            body = _extract_body(msg)
            snippet = _snippet(body)
            received_at = _parse_date(msg.get("Date"))
            message_id = msg.get("Message-ID")

            out.append({
                "uid": uid,
                "message_id": message_id,
                "from_addr": from_addr or "",
                "from_name": from_name or None,
                "to_addr": to_addr or None,
                "subject": subject,
                "body": body,
                "snippet": snippet,
                "received_at": received_at,
            })
        write_result({"ok": True, "emails": out})
    except Exception as e:
        fail(f"fetch error: {e}", e)
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            conn.logout()
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:
        fail(f"unhandled: {e}", e)
