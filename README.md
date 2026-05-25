<div align="center">
  <img src="logo.png" width="128" alt="MailMind icon" />

  # MailMind

  **Smart, private email triage for your Mac.**

  Sorts your inbox into 🔴 *requires reply* · 🟡 *important* · 📅 *events* · 🗑️ *noise*
  using a **local** AI model. Nothing leaves your computer.

  [![Latest release](https://img.shields.io/github/v/release/flowyee701/MailFilter?color=5b8cff&label=latest)](https://github.com/flowyee701/MailFilter/releases/latest)
  [![Downloads](https://img.shields.io/github/downloads/flowyee701/MailFilter/total?color=5b8cff)](https://github.com/flowyee701/MailFilter/releases/latest)
  [![License: MIT](https://img.shields.io/badge/license-MIT-5b8cff)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS%2011%2B%20·%20Apple%20Silicon-success)](#)
  [![Privacy](https://img.shields.io/badge/privacy-100%25%20local-22c55e)](PRIVACY.md)
</div>

---

## ⬇️ Download

<div align="center">

### [⬇ Download MailMind for Mac](https://github.com/flowyee701/MailFilter/releases/latest)

The latest `.dmg` is attached to every release — about 5 MB.

**[📖 Full step-by-step install guide → INSTALL.md](INSTALL.md)**

</div>

> **Requires:** Mac with Apple Silicon (M1 / M2 / M3 / M4), macOS 11 or newer.
> Intel Macs need to [build from source](#build-from-source).

---

## What it does

Pulls mail from any IMAP server (Yandex 360, Gmail, iCloud, generic IMAPS),
runs each new message through a **local** [Ollama](https://ollama.com) language
model, and shows your inbox already triaged into four buckets:

| | | |
|---|---|---|
| 🔴 | **Requires reply** | Someone is waiting for an answer from you |
| 🟡 | **Important** | Reports, company news, deliverables |
| 📅 | **Events** | Meeting invites, webinars, RSVPs |
| 🗑️ | **Noise** | Newsletters, automated alerts, marketing |

Plus:

- ✍️ **One-click draft replies** — language and tone match the original
- ☕ **Morning digest** — native macOS notification each day at your chosen hour
- 🎓 **Learns from your corrections** — change a category, and the classifier
  uses your decision as a hint on the next sync
- ⚡ **Heuristic pre-filter** skips obvious noise (no-reply@, newsletters,
  build bots) without burning an LLM call — typically 30–60% of corporate mail
- 🏛️ **Built-in presets for HSE corporate / Yandex personal / custom IMAP**

## Privacy

**100% local. Zero telemetry. No cloud. No third-party APIs.**
[Read the full audit-friendly PRIVACY.md →](PRIVACY.md)

The only network connections this app ever makes:
1. Your IMAP server (TLS, port 993) — to fetch your own mail
2. Your local Ollama at `127.0.0.1:11434` — to classify text
3. *Optional, only if you click "Download model" in onboarding:* Ollama
   contacts `registry.ollama.ai` to fetch the AI model — same request
   `ollama pull` makes on the command line. No user content sent.

Verifiable with Little Snitch / Lulu / tcpdump.

---

## For end users

[**📖 Open INSTALL.md →**](INSTALL.md) for the friendly step-by-step:
download, drag to Applications, first-launch consent, onboarding wizard,
mailbox setup. No Terminal required.

---

## For developers

### Build from source

```bash
# Toolchains (one-time)
brew install node ollama python
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
xcode-select --install

# Clone and run
git clone https://github.com/flowyee701/MailFilter.git
cd MailFilter
npm install
npm run tauri:dev      # development with hot reload

# Or build a production .app + .dmg
npm run tauri:build
# Outputs: src-tauri/target/release/bundle/{macos,dmg}/
```

Python sidecar deps auto-install on first launch into
`~/Library/Application Support/MailMind/python/.venv/`.

### Architecture

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

### File layout

```
MailFilter/
├── README.md, INSTALL.md, PRIVACY.md, LICENSE
├── logo.png, scripts/make_logo.py     # reproducible app icon
├── package.json, vite.config.ts, tailwind.config.js, tsconfig*.json, index.html
├── src/                       # React + Tailwind frontend
│   ├── App.tsx, main.tsx, index.css
│   ├── lib/{api.ts,types.ts}  # invoke() wrappers + shared types
│   └── components/
│       ├── Sidebar.tsx        # category nav with unread badges
│       ├── Inbox.tsx          # email list (grouped or filtered)
│       ├── EmailDetail.tsx    # body + recategorize + draft button
│       ├── DraftModal.tsx     # editable draft + copy to clipboard
│       ├── Settings.tsx       # IMAP / Ollama / digest config
│       ├── DigestView.tsx
│       └── Onboarding.tsx     # first-run wizard
├── src-tauri/                 # Rust backend
│   ├── Cargo.toml, tauri.conf.json, build.rs
│   └── src/
│       ├── main.rs            # Tauri builder + invoke handlers
│       ├── commands.rs        # all #[tauri::command] entry points
│       ├── db.rs              # SQLite schema + connection
│       ├── settings.rs        # Settings struct + Keychain integration
│       ├── ollama.rs          # /api/tags, /api/pull (streaming progress)
│       ├── python.rs          # spawn python scripts, JSON over stdio
│       └── scheduler.rs       # daily digest timer + native notification
└── python/                    # Python sidecars (spawned by Rust as subprocesses)
    ├── requirements.txt       # only `requests`
    ├── mm_io.py               # read JSON stdin, write JSON stdout
    ├── _ollama.py             # tiny HTTP client for Ollama /api/generate
    ├── fetch_emails.py        # imaplib → list of parsed messages
    ├── classify.py            # one email → {category, confidence}
    ├── draft.py               # one email → polite reply body
    └── digest.py              # 24h of emails → markdown summary
```

### Performance tuning

The classifier calls Ollama for every email it can't pre-filter. On Apple
Silicon, Mistral 7B costs 2–10 s per call. Three knobs:

1. **Use a smaller model.** `qwen2.5:3b` or `llama3.2:3b` classify short text
   as well as Mistral 7B at 2–4× the speed. The onboarding wizard recommends
   `qwen2.5:3b` by default.
2. **Lower Fetch limit** (Settings → IMAP → Fetch limit). Default 20.
3. **Heuristic pre-filter is already on.** Edit `NOISE_FROM_PATTERNS` /
   `NOISE_SUBJECT_PATTERNS` near the top of `python/classify.py`.

### Regenerating the app icon

```bash
python/.venv/bin/python scripts/make_logo.py
npx @tauri-apps/cli icon logo.png
```

`make_logo.py` is the canonical source — tweak the gradient / sparkle / dot
colors in there, rerun the two commands, and the full multi-size icon set
under `src-tauri/icons/` regenerates.

### Troubleshooting

- **`python3` not found**: install via `brew install python` or from python.org.
- **Ollama connection refused**: `curl http://localhost:11434/api/tags`
  should return JSON. If not, open the Ollama app, or `brew services start ollama`.
- **Classifier always returns "noise"**: switch to a stronger small model:
  `ollama pull qwen2.5:3b` and update Settings → Model.
- **Yandex login fails**: confirm you generated an *app password* — the
  regular account password is rejected over IMAP since 2023.
- **Keychain prompt on every sync**: click **Always Allow** (not just "Allow")
  in the macOS Keychain dialog.

---

## License

[MIT](LICENSE) — do whatever you want with it, no warranty.
