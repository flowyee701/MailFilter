# Privacy

**MailMind is local-first and zero-telemetry by design.** This document explains
exactly what data the app touches, where it lives, and what it never does.

## What MailMind does NOT do

- ❌ **No telemetry.** No analytics, no crash reporting, no usage metrics, no
  phone-home of any kind. The app makes zero outbound HTTP requests to any
  third-party service.
- ❌ **No cloud sync.** Nothing is copied to a remote server. No account, no
  signup, no API key for a hosted service.
- ❌ **No third-party LLM APIs.** Classification and drafting run on a local
  [Ollama](https://ollama.com) instance on `127.0.0.1`. Your email content
  never leaves your Mac.
- ❌ **No data sharing with the author** or anyone else.

## The only network calls MailMind makes

1. **Your IMAP server**, over TLS (e.g. `imap.yandex.ru:993`), to fetch your
   own mail. This is exactly what Apple Mail / Thunderbird do.
2. **Your local Ollama** at `http://127.0.0.1:11434` (loopback only), to
   classify and draft text. Ollama itself runs entirely on your machine.

That's it. You can verify this with `tcpdump` / Little Snitch / Lulu — the
only sockets the app opens are to those two endpoints.

## What is stored locally, and where

| Data | Location | Purpose |
|---|---|---|
| IMAP password | macOS Keychain (`MailMind / imap_password`) | So you don't re-enter it every launch |
| Fetched emails (subject, from, body, classification) | `~/Library/Application Support/MailMind/mailmind.db` (SQLite) | Inbox UI, badge counts, daily digest |
| Your manual category corrections | Same SQLite file, `corrections` table | Few-shot context for the classifier |
| Generated draft replies | Same SQLite file, `drafts` table | So drafts survive an app restart |
| App settings (host, model, digest hour…) | Same SQLite file, `settings` table | Configuration persistence |

Old emails are auto-deleted after **30 days** (configurable in Settings →
Retention). Emails you manually recategorized are kept indefinitely so the
classifier can still learn from them.

## How to wipe everything

```bash
# Delete the database (all emails, drafts, settings, corrections)
rm "$HOME/Library/Application Support/MailMind/mailmind.db"

# Remove the IMAP password from Keychain
security delete-generic-password -s MailMind -a imap_password
```

After running both commands you're back to a first-launch state — the app has
no memory of you.

## What MailMind sends to your IMAP server

The same IMAP commands any client uses: `LOGIN`, `SELECT INBOX`, `SEARCH ALL`,
`FETCH <uid> RFC822`. The connection is TLS-encrypted end-to-end. We do
**not** send, modify, delete, or move any messages on the server — MailMind
opens the inbox `readonly=True`.

## What MailMind sends to Ollama

For each unclassified email, a short prompt containing the sender, subject, and
a ~600-character snippet of the body. The model returns a category label and
confidence. Nothing is logged to disk by MailMind from this exchange — only the
returned category is stored. (Ollama itself may log requests if you've enabled
its debug logging; that's a setting on `ollama serve`, not something MailMind
controls.)

## Source code

Everything above is verifiable from the source. The places to look:

- Network calls: `python/fetch_emails.py` (IMAP) and `python/_ollama.py` (Ollama)
- Storage: `src-tauri/src/db.rs` (SQLite schema) and `src-tauri/src/settings.rs` (Keychain)
- No third-party SDK in `package.json` or `src-tauri/Cargo.toml` does any kind
  of analytics. Audit them yourself.

If you find a privacy regression in a future version, open an issue.
