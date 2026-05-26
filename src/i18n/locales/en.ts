// English — source of truth. Other locales mirror these keys.

const en: Record<string, string> = {
  // App-wide
  "app.name": "MailMind",
  "app.tagline": "Local-first email triage",
  "app.starting": "Starting…",
  "app.loading": "Loading…",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.saved": "Saved.",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.skip": "Skip for now",
  "common.recheck": "Re-check",
  "common.recheck_status": "Re-check status",
  "common.copy": "Copy to clipboard",
  "common.regenerate": "Regenerate",
  "common.regenerating": "Regenerating…",
  "common.generate_now": "Generate now",
  "common.generating": "Generating…",

  // Sidebar
  "sidebar.sync": "Sync inbox",
  "sidebar.syncing": "Syncing…",
  "sidebar.sync_result": "Fetched {fetched}, new {n}, classified {c}",
  "sidebar.sync_errors": ", {n} error(s)",
  "sidebar.sync_failed": "Sync failed: {err}",
  "sidebar.categories": "Categories",
  "sidebar.tools": "Tools",
  "sidebar.all_mail": "All mail",
  "sidebar.morning_digest": "Morning digest",
  "sidebar.settings": "Settings",
  "sidebar.rerun_setup": "Re-run setup",
  "sidebar.footer": "100% local · Ollama + IMAP",

  // Categories
  "category.reply": "Requires reply",
  "category.important": "Important",
  "category.event": "Events",
  "category.noise": "Noise",

  // Inbox
  "inbox.count": "{n} email(s)",
  "inbox.empty": "No emails here. Try \"Sync inbox\" in the sidebar.",
  "inbox.select_to_view": "Select an email to view",
  "inbox.draft_ready": "✓ draft ready",

  // Email detail
  "email.from": "From",
  "email.category": "Category:",
  "email.confidence": "conf: {pct}%",
  "email.generate_draft": "Generate draft",
  "email.drafting": "Drafting…",
  "email.view_draft": "View draft",
  "email.draft_failed": "Draft generation failed: {err}",
  "email.mark_as": "Mark as {label}",

  // Draft modal
  "draft.title": "Draft reply",
  "draft.to_re": "To: {to} · Re: {subject}",

  // Digest view
  "digest.title": "Morning digest",
  "digest.subtitle": "A summary of the last 24 hours of mail.",
  "digest.empty": "Click \"Generate now\" to produce a digest from the latest emails. A digest is also generated automatically each morning at the hour configured in Settings.",

  // Settings — top
  "settings.title": "Settings",
  "settings.subtitle": "All processing happens locally. Your password is stored in the OS keychain.",

  // Settings — sections
  "settings.section.account": "Account",
  "settings.section.imap": "IMAP",
  "settings.section.ollama": "Ollama",
  "settings.section.digest": "Digest & retention",
  "settings.section.language": "Language",

  // Settings — IMAP fields
  "settings.preset": "Preset",
  "settings.server": "Server",
  "settings.port": "Port",
  "settings.login": "Login (full email)",
  "settings.app_password": "App password",
  "settings.app_password_placeholder": "••••••••  (leave blank to keep current)",
  "settings.mailbox": "Mailbox",
  "settings.fetch_limit": "Fetch limit",

  // Settings — Ollama fields
  "settings.ollama_url": "Ollama URL",
  "settings.model": "Model",

  // Settings — Digest fields
  "settings.digest_hour": "Digest hour (0–23)",
  "settings.retention_days": "Retention (days)",

  // Settings — Language picker
  "settings.language_label": "Display language",

  // Settings — buttons
  "settings.test_connection": "Test connection",
  "settings.testing": "Testing…",
  "settings.test_ok": "Connection OK ✓",
  "settings.test_fail": "Connection failed ✗",
  "settings.save_failed": "Save failed: {err}",
  "settings.test_failed": "Test failed: {err}",

  // Settings — preset labels
  "preset.yandex_corp": "Yandex 360 (corporate)",
  "preset.yandex": "Yandex personal",
  "preset.gmail": "Gmail / Google Workspace",
  "preset.outlook": "Outlook / Microsoft 365",
  "preset.icloud": "iCloud Mail",
  "preset.yahoo": "Yahoo Mail",
  "preset.mailru": "Mail.ru",
  "preset.custom": "Custom IMAP server",

  // Onboarding
  "onboarding.welcome": "Welcome to MailMind",
  "onboarding.subtitle": "Local-first email triage. Let's get the few pieces in place. Everything below runs on your Mac — nothing leaves it.",
  "onboarding.step1.title": "Ollama (local AI runtime)",
  "onboarding.step1.ok": "Running on http://127.0.0.1:11434",
  "onboarding.step1.desc_missing": "Ollama is what runs the language model on your Mac. It's a free, open-source app from ollama.com.",
  "onboarding.step1.btn_download": "Download Ollama (opens browser) →",
  "onboarding.step1.hint": "After installing Ollama from the .dmg and opening it once, come back here and click Re-check.",
  "onboarding.step1.desc_stopped": "Ollama is installed but the background service isn't running yet.",
  "onboarding.step1.btn_start": "Start Ollama",
  "onboarding.step1.starting": "Starting…",
  "onboarding.step2.title": "Pick a model and download it",
  "onboarding.step2.selected": "Selected: {model}",
  "onboarding.step2.installed_list": "Installed: {list}",
  "onboarding.step2.tag_recommended": "recommended",
  "onboarding.step2.tag_installed": "installed",
  "onboarding.step2.btn_download": "Download {model}",
  "onboarding.step2.downloading": "Downloading…",
  "onboarding.step2.starting": "starting…",
  "onboarding.step2.already": "✓ {model} is already pulled. You can change models any time in Settings → Ollama.",
  "onboarding.step3.title": "Python runtime",
  "onboarding.step3.ok": "Auto-configured in ~/Library/Application Support/MailMind",
  "onboarding.step3.desc_missing": "MailMind couldn't find a working Python 3. macOS usually ships with one — if not, install it once via the official installer or Homebrew.",
  "onboarding.step3.btn_download": "Download Python (opens browser) →",
  "onboarding.btn_open_app": "Open MailMind →",
  "onboarding.btn_continue_email": "Continue to email setup →",

  // Preset help texts
  "help.yandex_corp.title": "Corporate Yandex 360 — one-time setup",
  "help.yandex_corp.intro": "Corporate Yandex 360 sits behind your company's SSO (HSE LMS, Okta, custom auth, etc.). IMAP is a 1980s protocol and can't drive a web SSO flow — every IMAP client (Apple Mail, Thunderbird, K-9…) handles this the same way: you generate a one-time app password on the Yandex side, and the client uses it directly.",
  "help.yandex_corp.step1": "Open id.yandex.ru/security/app-passwords in your browser. Log in the normal way (your company SSO → done).",
  "help.yandex_corp.step2": "Click Create new password → choose Email applications (IMAP, POP3, SMTP).",
  "help.yandex_corp.step3": "Yandex shows a 16-character password once. Copy it and paste it into the App password field above. Then click Save, then Test.",
  "help.yandex_corp.footer": "If app passwords are disabled by your organization, ask IT to enable IMAP + application passwords for your account. There is no other client-side workaround — SSO-only accounts simply cannot use IMAP.",

  "help.yandex.body": "At mail.yandex.com → Settings → Mail clients enable IMAP, then generate an app password at id.yandex.com/security/app-passwords. Paste it into the App password field — your normal account password is rejected over IMAP since 2023.",

  "help.gmail.body": "Enable IMAP at mail.google.com → Settings → Forwarding and POP/IMAP. Then create an app password at myaccount.google.com/apppasswords (requires 2-Step Verification turned on). Paste the 16-character app password — your normal Google password will not work.",

  "help.outlook.body": "For personal Outlook/Hotmail/Live: enable IMAP at outlook.live.com → Settings → Mail → Sync email. For Microsoft 365 / corporate: IMAP is often disabled by the tenant admin. If enabled, you'll need an app password (account.microsoft.com → Security → Advanced security options → App passwords). Many corporate tenants require OAuth instead of IMAP — not yet supported here.",

  "help.icloud.body": "iCloud Mail requires an app-specific password. Sign in at account.apple.com → Sign-in and Security → App-Specific Passwords → Generate. Paste the result into the App password field. Two-factor authentication must be enabled on your Apple ID.",

  "help.yahoo.body": "Yahoo requires an app password. Go to login.yahoo.com → Account Security → Manage app passwords → Generate. Paste the result here. Two-step verification must be enabled.",

  "help.mailru.body": "At Mail.ru turn on IMAP under Settings → Mail programs, then create a password for external apps at id.mail.ru/security/app-passwords. Paste the generated password — your normal Mail.ru password is rejected by IMAP.",

  "help.custom.body": "Generic IMAPS endpoint. Fill in host (e.g. imap.example.com), port (993 for IMAPS), full-email login, and either your password or an app password if your provider enforces 2FA.",

  // Model picker notes
  "model.note.qwen": "Best speed/accuracy trade-off on Apple Silicon. Recommended.",
  "model.note.llama": "Strong alternative to Qwen. English-focused.",
  "model.note.mistral": "Larger, slower, sometimes more nuanced. Heavier on the fans.",
};

export default en;
