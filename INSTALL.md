<div align="center">
  <img src="logo.png" width="96" alt="MailMind icon" />

  # Installing MailMind

  A click-by-click guide for non-technical users. No Terminal required
  (with one optional exception, called out below).
</div>

---

## Before you start

You'll need:

- A Mac with **Apple Silicon** (chip M1, M2, M3, or M4) — check via  → *About This Mac*
- macOS 11 (Big Sur) or newer
- About 5 minutes for MailMind itself, plus ~10 minutes if you also need to install Ollama and download an AI model

> **Intel Mac?** The prebuilt download is Apple-Silicon only. You can still
> run MailMind by [building from source](README.md#build-from-source) — that
> path takes ~20 minutes and does require Terminal.

---

## Step 1 — Download the app

1. Open the latest release page in your browser:
   **<https://github.com/flowyee701/MailFilter/releases/latest>**
2. Scroll to the **Assets** section.
3. Click **`MailMind_0.2.1_aarch64.dmg`** to download (~5 MB).

## Step 2 — Install it

1. Open your **Downloads** folder and **double-click** the file you just got
   (`MailMind_0.2.1_aarch64.dmg`).
2. A window pops up showing the MailMind icon next to an **Applications**
   shortcut. **Drag the MailMind icon onto the Applications shortcut.**
3. When the copy finishes, close the window. You can also eject the disk
   image from Finder's sidebar.

## Step 3 — Open it the first time (one-time security consent)

MailMind is open-source and not signed with a paid Apple Developer
certificate, so the first launch needs your explicit consent. **This only
happens once.**

1. Open **Finder** → **Applications**.
2. **Right-click** (or hold Control and click) on **MailMind**.
3. Choose **Open** from the menu.
4. A dialog appears saying *"MailMind cannot be opened because the
   developer cannot be verified."* — click **Open**.
5. macOS now remembers that you approve this app. From now on you can
   launch it normally — Dock, Launchpad, Spotlight, double-click, anything.

<details>
<summary>What if I see "MailMind is damaged and can't be opened"?</summary>

That's a stricter Gatekeeper variant (recent macOS versions sometimes show
it). One Terminal command clears it permanently:

1. Open **Terminal** (⌘-Space → type "Terminal" → Enter).
2. Paste this exact line and press Enter:

   ```bash
   xattr -dr com.apple.quarantine /Applications/MailMind.app
   ```

3. Close Terminal. Double-click MailMind in Applications — it opens normally now.

This is the only Terminal command you should ever need.

</details>

## Step 4 — Run the built-in setup wizard

When MailMind launches for the first time, you see a **Welcome** screen
with a three-step checklist. Each step has a clear button.

### 4a. Ollama (the local AI engine)

Ollama is a free, open-source app from <https://ollama.com> that runs the
language model locally on your Mac. MailMind needs it.

- **If you don't have Ollama yet:** click **Download Ollama** in MailMind.
  Your browser opens ollama.com — download the macOS installer, open it,
  and drag Ollama to Applications like any normal Mac app. Then go back to
  MailMind and click **Re-check**.
- **If Ollama is installed but not running:** click **Start Ollama**.
  MailMind starts it for you.
- ✓ When it's running, you see a green check on this step.

### 4b. Pick an AI model

MailMind shows three options. **The recommended one is highlighted**:

| Model | Size | Notes |
|---|---|---|
| **Qwen 2.5 (3B)** ⭐ | ~1.9 GB | Best speed/quality on Apple Silicon — recommended |
| Llama 3.2 (3B) | ~2.0 GB | Strong alternative, English-focused |
| Mistral (7B) | ~4.4 GB | Larger and slower; works fine on M2/M3/M4 |

Pick one (Qwen 2.5 is fine for everyone) and click **Download**. A progress
bar inside MailMind shows the download speed. **All inside the app — no
Terminal.** Takes 1–5 minutes depending on your internet.

### 4c. Python

Usually green automatically (macOS ships with Python preinstalled). If you
see a red mark, click the link to download Python from python.org and
install it like any other Mac app, then click **Re-check**.

When all three steps are green, click **Continue to email setup →**.

## Step 5 — Connect your email

MailMind opens the **Settings** screen.

### 5a. Pick your account preset

From the **Preset** dropdown:

- **HSE corporate (Yandex 360)** — for `@hse.ru` or `@edu.hse.ru` addresses
- **Yandex personal** — for `@yandex.com` / `@yandex.ru` etc.
- **Custom IMAP server** — anything else (fill in host/port yourself)

The preset fills in the IMAP server and port automatically.

### 5b. Enter your email

Type your **full email address** in the **Login** field.

### 5c. Generate an "app password"

This is the one thing that can't be done from inside MailMind, because of
how email servers work. **You do not enter your normal login password.**
Instead, your email provider gives you a special one-time-generated
password just for mail apps. Apple Mail, Thunderbird, and every other
mail client require the same thing — this isn't a MailMind quirk.

**For HSE corporate and Yandex personal:**

1. Open <https://id.yandex.ru/security/app-passwords> in your browser.
2. Sign in normally (HSE users: the HSE SSO / LMS flow works fine here —
   you just sign in like you'd sign in to any HSE service).
3. Click **Create new password** → choose **Email applications (IMAP, POP3, SMTP)**.
4. Yandex shows a **16-character password** with spaces. Copy it.
5. Back in MailMind, paste that password into the **App password** field.

> **Heads-up:** Yandex only shows the app password **once**. If you close
> the page without copying it, you have to generate a new one.

### 5d. Save and test

1. Click **Save** in MailMind.
2. Click **Test connection** — you should see **✓ Connection OK** in green.
3. If you see a macOS dialog asking *"MailMind wants to use your confidential
   information stored in 'MailMind' in your keychain"* — type your **Mac
   login password** (the password you use to unlock your Mac) and click
   **Always Allow**. This stores your IMAP password encrypted in the OS
   Keychain so MailMind can read it without bothering you again.

## Step 6 — Sync your inbox

1. Click **Sync inbox** in the sidebar (top of the left panel).
2. MailMind fetches the 20 most recent emails and runs each through the
   local AI. First sync takes 30–90 seconds depending on the model and
   your Mac.
3. Watch the category badges on the left fill up: 🔴 🟡 📅 🗑️.
4. Click any email to read it. Use the four colored pill buttons at the
   top of the detail view to **manually move an email to a different
   category** — MailMind remembers your decision and uses it as a hint
   for future emails from the same sender.

That's the entire installation. Welcome to a quieter inbox.

---

## Daily use

- **Sync inbox** whenever you want to pull new mail (it doesn't poll
  automatically by design — you control when network activity happens).
- **Morning digest** runs automatically each day at the time you set in
  Settings (default 08:00) and shows a native macOS notification.
- **Generate draft** button on any 🔴 *Requires reply* email writes a draft
  response you can copy into your normal mail client.

## If something breaks

- Re-open the setup wizard any time: **🛠️ Re-run setup** in the sidebar.
- Change your AI model later: **Settings → Ollama → Model**.
- Wipe all local data (emails, drafts, settings, saved password): follow
  the **"How to wipe everything"** section of [PRIVACY.md](PRIVACY.md).
- Report a bug: <https://github.com/flowyee701/MailFilter/issues>

## Privacy reminder

Everything stays on your Mac. No telemetry, no analytics, no cloud sync,
no third-party API. Your mail content **literally cannot leave the device**
because the app makes no outbound connections except to your IMAP server
and your local Ollama. Full audit-friendly details in [PRIVACY.md](PRIVACY.md).
