# MailMind

> **Local-first smart inbox triage for macOS.** Pulls your mail over IMAP,
> classifies each message into 🔴 *requires reply* / 🟡 *important* /
> 📅 *event* / 🗑️ *noise* using a local Ollama model, generates draft replies,
> and produces a morning digest. **No cloud, no telemetry, no API keys —
> everything runs on your Mac.** See [PRIVACY.md](PRIVACY.md).

```
+----------------+    JSON      +----------------+    HTTP     +-----------+
|  React (Tauri) | <----------> |  Rust backend  | <---------> |  Ollama   |
|   inbox UI     |  invoke()    |  + SQLite      |  python →   |  (mistral)|
+----------------+              +----------------+   IMAP TLS  +-----------+
                                        |                            ▲
                                        v                            |
                                  python sidecars  ------------------+
                                  (fetch / classify / draft / digest)
```

## Features

- 📥 IMAP fetcher with built-in **HSE corporate (Yandex 360)** and **Yandex
  personal** presets — one click and the right host/port/login format is
  filled in for you.
- 🧠 Local LLM classification via Ollama. Default model `mistral` (7B); switch
  to `qwen2.5:3b` or `llama3.2:3b` for 2–4× the speed on Apple Silicon.
- ⚡ **Heuristic pre-filter** skips obvious noise (no-reply@, newsletters,
  JIRA bots, mailer-daemons) without burning a single LLM token — cuts a
  typical sync time by 30–60%.
- ✍️ **One-click draft replies** for any "Requires reply" email, in the same
  language and tone as the incoming message.
- ☕ **Morning digest** auto-generated each day at your chosen hour, with a
  native macOS notification preview.
- 🎓 **Learn from corrections.** Every time you change an email's category,
  the (sender, subject, new category) tuple becomes a few-shot example for
  the next classification pass.
- 🔒 **App-password aware.** Built around the reality that corporate SSO
  (HSE → LMS, Okta, etc.) can't drive IMAP — clear in-app guidance walks you
  through generating the right token.

## Privacy

**Read [PRIVACY.md](PRIVACY.md) for the full breakdown.** Short version:

- The only network connections MailMind makes are to your **IMAP server**
  (TLS, port 993) and your **local Ollama** (`127.0.0.1:11434`).
- No telemetry, no analytics, no third-party API.
- Password lives in macOS Keychain. Emails live in a local SQLite at
  `~/Library/Application Support/MailMind/`. Neither ever leaves your Mac.
- One-line wipe instructions in PRIVACY.md.

## Installing

### Option A — Pre-built `.dmg` (Apple Silicon)

Grab the latest `.dmg` from the [Releases page](https://github.com/flowyee701/MailFilter/releases),
double-click, drag MailMind to Applications.

> **Gatekeeper note** — the binary is **not** Apple-notarized (notarization
> needs a paid Developer Program account). The first time you launch:
> **right-click → Open → Open**, and macOS will remember the exception. If
> you see "MailMind is damaged and can't be opened," run:
> ```bash
> xattr -dr com.apple.quarantine /Applications/MailMind.app
> ```

You still need to install the runtime dependencies (one-time):

```bash
# Ollama (the local LLM runtime)
brew install ollama
brew services start ollama
ollama pull qwen2.5:3b      # or: ollama pull mistral

# Python 3 + requests (used by the IMAP / classifier sidecars)
brew install python          # if you don't already have python3
# MailMind auto-creates a venv on first launch and installs `requests` into it
```

### Option B — Build from source

```bash
# 1. Toolchains
brew install node ollama python
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
xcode-select --install   # Tauri needs the Xcode Command Line Tools

# 2. Clone + install
git clone https://github.com/flowyee701/MailFilter.git
cd MailFilter
npm install
python3 -m venv python/.venv
python/.venv/bin/python -m pip install -r python/requirements.txt

# 3. Start Ollama and pull a model
brew services start ollama
ollama pull qwen2.5:3b

# 4. Dev mode (hot-reload)
npm run tauri:dev

# 5. Or build a production .app + .dmg
npm run tauri:build
# Output: src-tauri/target/release/bundle/{macos,dmg}/
```

## First-launch checklist

1. Open **Settings** in the sidebar.
2. Pick your **Account preset** (HSE corporate / Yandex personal / Custom).
3. Generate an **app password** at the URL the help panel shows. *Why an app
   password?* IMAP is a 1980s protocol and cannot drive a web SSO flow — every
   IMAP client (Apple Mail, Thunderbird…) uses an app password for the same
   reason. See the panel in Settings for step-by-step instructions.
4. Paste the app password → **Save** → **Test connection** should show ✓.
5. **Sync inbox** in the sidebar. The first sync fetches the last 20 emails
   and classifies them through Ollama. Subsequent syncs reuse the warm model.
6. Click any email → use the four category pills at the top to recategorize.
   Your corrections feed the classifier on the next sync.

## Performance tuning

The classifier calls Ollama for every email it can't pre-filter, and Mistral 7B
on Apple Silicon costs ~2–10 seconds per call. Three knobs:

1. **Use a smaller model.** `qwen2.5:3b` or `llama3.2:3b` classify short text
   essentially as well as Mistral 7B at 2–4× the speed:
   ```bash
   ollama pull qwen2.5:3b
   ```
   Then Settings → Ollama → Model → `qwen2.5:3b` → Save.
2. **Lower Fetch limit** (Settings → IMAP → Fetch limit). Default is 20.
3. **Heuristic pre-filter is already on.** Edit `NOISE_FROM_PATTERNS` /
   `NOISE_SUBJECT_PATTERNS` near the top of `python/classify.py` to tune it
   — no rebuild needed, Python scripts are spawned fresh each sync.

## File layout

```
MailFilter/
├── LICENSE, PRIVACY.md, README.md
├── package.json, vite.config.ts, tailwind.config.js, tsconfig*.json, index.html
├── src/                        # React + Tailwind frontend
│   ├── App.tsx, main.tsx, index.css
│   ├── lib/{api.ts,types.ts}   # invoke() wrappers + shared types
│   └── components/{Sidebar,Inbox,EmailDetail,DraftModal,Settings,DigestView}.tsx
├── src-tauri/                  # Rust backend
│   ├── Cargo.toml, tauri.conf.json, build.rs
│   └── src/
│       ├── main.rs             # Tauri builder + invoke handlers
│       ├── commands.rs         # All #[tauri::command] entry points
│       ├── db.rs               # SQLite schema + connection
│       ├── settings.rs         # Settings struct, Keychain integration
│       ├── python.rs           # Spawn python scripts, JSON over stdio
│       └── scheduler.rs        # Daily digest timer + native notification
└── python/                     # Python sidecars (spawned by Rust as subprocesses)
    ├── requirements.txt        # only `requests`
    ├── mm_io.py                # read JSON stdin, write JSON stdout
    ├── _ollama.py              # tiny HTTP client for Ollama /api/generate
    ├── fetch_emails.py         # imaplib → list of parsed messages
    ├── classify.py             # one email → {category, confidence} (+ noise heuristics)
    ├── draft.py                # one email → polite reply body
    └── digest.py               # 24h of emails → markdown summary
```

## Troubleshooting

- **`python3` not found**: install via `brew install python` or from python.org.
  Or set `MAILMIND_PYTHON=/full/path/to/python` in your environment before launching.
- **"No module named 'requests'"**: run `python/.venv/bin/python -m pip install -r python/requirements.txt`.
- **Ollama connection refused**: `curl http://localhost:11434/api/tags` should
  return JSON. If not, run `brew services start ollama` (or open the Ollama app).
- **Classifier always returns "noise"**: the model occasionally ignores the
  JSON format hint. Switch to a stronger small model: `ollama pull qwen2.5:3b`
  and update Settings → Model.
- **Yandex login fails**: confirm you generated an *app password* — the
  regular account password is rejected over IMAP since 2023.
- **Keychain prompt on every sync**: in the macOS Keychain dialog, click
  **Always Allow** (not just "Allow"). The "exec" lock icon is normal for an
  unsigned dev build.

## License

MIT — see [LICENSE](LICENSE).
