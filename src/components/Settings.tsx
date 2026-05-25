import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Settings as TSettings } from "../lib/types";

type PresetKey = "hse" | "yandex" | "custom";

interface Preset {
  key: PresetKey;
  label: string;
  host: string;
  port: number;
  loginPlaceholder: string;
  detector?: (login: string) => boolean;
  helpJsx: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    key: "hse",
    label: "HSE corporate (Yandex 360)",
    host: "imap.yandex.ru",
    port: 993,
    loginPlaceholder: "name.surname@hse.ru  /  …@edu.hse.ru",
    detector: (l) => /@(edu\.)?hse\.ru$/i.test(l),
    helpJsx: <HSEHelp />,
  },
  {
    key: "yandex",
    label: "Yandex personal",
    host: "imap.yandex.com",
    port: 993,
    loginPlaceholder: "you@yandex.com / @yandex.ru",
    detector: (l) => /@yandex\.(com|ru|by|kz|com\.tr)$/i.test(l),
    helpJsx: <YandexHelp />,
  },
  {
    key: "custom",
    label: "Custom IMAP server",
    host: "",
    port: 993,
    loginPlaceholder: "user@example.com",
    helpJsx: <CustomHelp />,
  },
];

export function Settings() {
  const [s, setS] = useState<TSettings | null>(null);
  const [presetKey, setPresetKey] = useState<PresetKey>("hse");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Initial load — pick a preset based on stored host or detected from login.
  useEffect(() => {
    api
      .loadSettings()
      .then((loaded) => {
        setS(loaded);
        setPresetKey(detectPreset(loaded));
      })
      .catch((e) => setMessage(String(e)));
  }, []);

  const preset = useMemo(
    () => PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0],
    [presetKey],
  );

  if (!s) return <div className="p-8 text-muted">Loading…</div>;

  const update = <K extends keyof TSettings>(k: K, v: TSettings[K]) =>
    setS({ ...s, [k]: v });

  const applyPreset = (key: PresetKey) => {
    setPresetKey(key);
    const p = PRESETS.find((x) => x.key === key)!;
    if (p.key !== "custom") {
      setS({ ...s, imap_host: p.host, imap_port: p.port });
    }
  };

  const onLoginChange = (v: string) => {
    update("login", v);
    if (presetKey === "custom" || presetKey === "hse" || presetKey === "yandex") {
      const detected = PRESETS.find((p) => p.detector?.(v));
      if (detected && detected.key !== presetKey) {
        // Soft re-suggest preset only if host is still the default of *some* preset.
        const stillOnAPreset = PRESETS.some((p) => p.host === s.imap_host);
        if (stillOnAPreset) applyPreset(detected.key);
      }
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.saveSettings(s);
      const reloaded = await api.loadSettings();
      setS({ ...reloaded, password: "" });
      setMessage("Saved.");
    } catch (e) {
      setMessage(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const ok = await api.testConnection();
      setMessage(ok ? "Connection OK ✓" : "Connection failed ✗");
    } catch (e) {
      setMessage(`Test failed: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          All processing happens locally. Your password is stored in the OS keychain.
        </p>

        <Section title="Account">
          <Row label="Preset">
            <select
              value={presetKey}
              onChange={(e) => applyPreset(e.target.value as PresetKey)}
              className="w-full bg-bg border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Row>
          <div className="px-4 py-3 text-xs text-muted bg-panel/40">
            {preset.helpJsx}
          </div>
        </Section>

        <Section title="IMAP">
          <Row label="Server">
            <Input
              value={s.imap_host}
              onChange={(v) => update("imap_host", v)}
              disabled={presetKey !== "custom"}
            />
          </Row>
          <Row label="Port">
            <Input
              type="number"
              value={String(s.imap_port)}
              onChange={(v) => update("imap_port", Number(v) || 993)}
              disabled={presetKey !== "custom"}
            />
          </Row>
          <Row label="Login (full email)">
            <Input
              value={s.login}
              placeholder={preset.loginPlaceholder}
              onChange={onLoginChange}
            />
          </Row>
          <Row label="App password">
            <Input
              type="password"
              placeholder="••••••••  (leave blank to keep current)"
              value={s.password ?? ""}
              onChange={(v) => update("password", v)}
            />
          </Row>
          <Row label="Mailbox">
            <Input value={s.mailbox} onChange={(v) => update("mailbox", v)} />
          </Row>
          <Row label="Fetch limit">
            <Input
              type="number"
              value={String(s.fetch_limit)}
              onChange={(v) => update("fetch_limit", Number(v) || 50)}
            />
          </Row>
        </Section>

        <Section title="Ollama">
          <Row label="Ollama URL">
            <Input value={s.ollama_url} onChange={(v) => update("ollama_url", v)} />
          </Row>
          <Row label="Model">
            <Input value={s.model} onChange={(v) => update("model", v)} />
          </Row>
        </Section>

        <Section title="Digest & retention">
          <Row label="Digest hour (0–23)">
            <Input
              type="number"
              value={String(s.digest_hour)}
              onChange={(v) => update("digest_hour", Number(v) || 8)}
            />
          </Row>
          <Row label="Retention (days)">
            <Input
              type="number"
              value={String(s.retention_days)}
              onChange={(v) => update("retention_days", Number(v) || 30)}
            />
          </Row>
        </Section>

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={test}
            disabled={testing}
            className="px-4 py-2 rounded-md text-sm bg-panel2 text-text hover:bg-panel2/70 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          {message && <span className="ml-2 text-xs text-muted">{message}</span>}
        </div>
      </div>
    </div>
  );
}

function detectPreset(s: TSettings): PresetKey {
  const byLogin = PRESETS.find((p) => p.detector?.(s.login));
  if (byLogin) return byLogin.key;
  const byHost = PRESETS.find((p) => p.host === s.imap_host && p.host !== "");
  if (byHost) return byHost.key;
  return "hse";
}

function HSEHelp() {
  return (
    <div className="space-y-2 leading-relaxed">
      <p>
        <b>Why no SSO / LMS login here?</b> IMAP is a 1980s protocol — it can't drive
        a web SSO flow. Every IMAP client (Apple Mail, Thunderbird, K-9…) handles
        this the same way: you generate a one-time <b>app password</b> on the
        Yandex side, and the client uses it directly.
      </p>
      <p>
        <b>One-time setup for HSE:</b>
      </p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>
          Open <span className="font-mono">id.yandex.ru/security/app-passwords</span>{" "}
          in your browser. Log in the normal way (HSE SSO → LMS → done).
        </li>
        <li>
          Click <i>Create new password</i> → choose <i>Email applications (IMAP, POP3, SMTP)</i>.
        </li>
        <li>
          Yandex shows a 16-character password <i>once</i>. Copy it and paste it
          into the <b>App password</b> field above. Then click Save, then Test.
        </li>
      </ol>
      <p className="text-[11px] opacity-80">
        If app passwords are disabled by HSE policy, ask IT to enable IMAP +
        application passwords for your account. There is no other client-side
        workaround — SSO-only accounts simply cannot use IMAP.
      </p>
    </div>
  );
}

function YandexHelp() {
  return (
    <div className="space-y-2 leading-relaxed">
      <p>
        At <span className="font-mono">mail.yandex.com → Settings → Mail clients</span>{" "}
        enable IMAP, then generate an <b>app password</b> at{" "}
        <span className="font-mono">id.yandex.com/security/app-passwords</span>.
        Paste it into the App password field — your normal account password is
        rejected over IMAP since 2023.
      </p>
    </div>
  );
}

function CustomHelp() {
  return (
    <div className="space-y-2 leading-relaxed">
      <p>
        Generic IMAPS endpoint. Fill in host (e.g. <span className="font-mono">imap.example.com</span>),
        port (993 for IMAPS), full-email login, and either your password or an
        app password if your provider enforces 2FA.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        {title}
      </h2>
      <div className="bg-panel border border-border rounded-lg divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-4 px-4 py-3">
      <label className="text-sm text-muted">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-bg border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed"
    />
  );
}
