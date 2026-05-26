import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Settings as TSettings } from "../lib/types";
import { useI18n, useT, LANGUAGES, type Lang } from "../i18n";

type PresetKey =
  | "yandex_corp"
  | "yandex"
  | "gmail"
  | "outlook"
  | "icloud"
  | "yahoo"
  | "mailru"
  | "custom";

interface Preset {
  key: PresetKey;
  labelKey: string;
  helpKey: string;
  host: string;
  port: number;
  loginPlaceholder: string;
  detector?: (login: string) => boolean;
}

// Order = order in the dropdown.
const PRESETS: Preset[] = [
  {
    key: "yandex_corp",
    labelKey: "preset.yandex_corp",
    helpKey: "yandex_corp",
    host: "imap.yandex.ru",
    port: 993,
    loginPlaceholder: "name.surname@company.tld",
    detector: (l) => /@(edu\.)?hse\.ru$/i.test(l),
  },
  {
    key: "yandex",
    labelKey: "preset.yandex",
    helpKey: "yandex",
    host: "imap.yandex.com",
    port: 993,
    loginPlaceholder: "you@yandex.com / @yandex.ru",
    detector: (l) => /@yandex\.(com|ru|by|kz|com\.tr)$/i.test(l),
  },
  {
    key: "gmail",
    labelKey: "preset.gmail",
    helpKey: "gmail",
    host: "imap.gmail.com",
    port: 993,
    loginPlaceholder: "you@gmail.com",
    detector: (l) => /@(gmail\.com|googlemail\.com)$/i.test(l),
  },
  {
    key: "outlook",
    labelKey: "preset.outlook",
    helpKey: "outlook",
    host: "outlook.office365.com",
    port: 993,
    loginPlaceholder: "you@outlook.com / @hotmail.com / @company.com",
    detector: (l) =>
      /@(outlook\.com|hotmail\.com|live\.com|msn\.com|office365\.com)$/i.test(l),
  },
  {
    key: "icloud",
    labelKey: "preset.icloud",
    helpKey: "icloud",
    host: "imap.mail.me.com",
    port: 993,
    loginPlaceholder: "you@icloud.com / @me.com / @mac.com",
    detector: (l) => /@(icloud\.com|me\.com|mac\.com)$/i.test(l),
  },
  {
    key: "yahoo",
    labelKey: "preset.yahoo",
    helpKey: "yahoo",
    host: "imap.mail.yahoo.com",
    port: 993,
    loginPlaceholder: "you@yahoo.com",
    detector: (l) => /@yahoo\.(com|co\.\w+|fr|de|it|es|ca|com\.\w+)$/i.test(l),
  },
  {
    key: "mailru",
    labelKey: "preset.mailru",
    helpKey: "mailru",
    host: "imap.mail.ru",
    port: 993,
    loginPlaceholder: "you@mail.ru / @bk.ru / @list.ru / @inbox.ru",
    detector: (l) => /@(mail\.ru|bk\.ru|list\.ru|inbox\.ru|internet\.ru)$/i.test(l),
  },
  {
    key: "custom",
    labelKey: "preset.custom",
    helpKey: "custom",
    host: "",
    port: 993,
    loginPlaceholder: "user@example.com",
  },
];

export function Settings() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [s, setS] = useState<TSettings | null>(null);
  const [presetKey, setPresetKey] = useState<PresetKey>("yandex_corp");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  if (!s) return <div className="p-8 text-muted">{t("app.loading")}</div>;

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
    const detected = PRESETS.find((p) => p.detector?.(v));
    if (detected && detected.key !== presetKey) {
      const stillOnAPreset = PRESETS.some((p) => p.host === s.imap_host);
      if (stillOnAPreset) applyPreset(detected.key);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.saveSettings(s);
      const reloaded = await api.loadSettings();
      setS({ ...reloaded, password: "" });
      setMessage(t("common.saved"));
    } catch (e) {
      setMessage(t("settings.save_failed", { err: String(e) }));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const ok = await api.testConnection();
      setMessage(ok ? t("settings.test_ok") : t("settings.test_fail"));
    } catch (e) {
      setMessage(t("settings.test_failed", { err: String(e) }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>

        <Section title={t("settings.section.language")}>
          <Row label={t("settings.language_label")}>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="w-full bg-bg border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title={t("settings.section.account")}>
          <Row label={t("settings.preset")}>
            <select
              value={presetKey}
              onChange={(e) => applyPreset(e.target.value as PresetKey)}
              className="w-full bg-bg border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {t(p.labelKey)}
                </option>
              ))}
            </select>
          </Row>
          <div className="px-4 py-3 text-xs text-muted bg-panel/40 leading-relaxed">
            <PresetHelp preset={preset} />
          </div>
        </Section>

        <Section title={t("settings.section.imap")}>
          <Row label={t("settings.server")}>
            <Input
              value={s.imap_host}
              onChange={(v) => update("imap_host", v)}
              disabled={presetKey !== "custom"}
            />
          </Row>
          <Row label={t("settings.port")}>
            <Input
              type="number"
              value={String(s.imap_port)}
              onChange={(v) => update("imap_port", Number(v) || 993)}
              disabled={presetKey !== "custom"}
            />
          </Row>
          <Row label={t("settings.login")}>
            <Input
              value={s.login}
              placeholder={preset.loginPlaceholder}
              onChange={onLoginChange}
            />
          </Row>
          <Row label={t("settings.app_password")}>
            <Input
              type="password"
              placeholder={t("settings.app_password_placeholder")}
              value={s.password ?? ""}
              onChange={(v) => update("password", v)}
            />
          </Row>
          <Row label={t("settings.mailbox")}>
            <Input value={s.mailbox} onChange={(v) => update("mailbox", v)} />
          </Row>
          <Row label={t("settings.fetch_limit")}>
            <Input
              type="number"
              value={String(s.fetch_limit)}
              onChange={(v) => update("fetch_limit", Number(v) || 20)}
            />
          </Row>
        </Section>

        <Section title={t("settings.section.ollama")}>
          <Row label={t("settings.ollama_url")}>
            <Input value={s.ollama_url} onChange={(v) => update("ollama_url", v)} />
          </Row>
          <Row label={t("settings.model")}>
            <Input value={s.model} onChange={(v) => update("model", v)} />
          </Row>
        </Section>

        <Section title={t("settings.section.digest")}>
          <Row label={t("settings.digest_hour")}>
            <Input
              type="number"
              value={String(s.digest_hour)}
              onChange={(v) => update("digest_hour", Number(v) || 8)}
            />
          </Row>
          <Row label={t("settings.retention_days")}>
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
            {saving ? t("common.saving") : t("common.save")}
          </button>
          <button
            onClick={test}
            disabled={testing}
            className="px-4 py-2 rounded-md text-sm bg-panel2 text-text hover:bg-panel2/70 disabled:opacity-50"
          >
            {testing ? t("settings.testing") : t("settings.test_connection")}
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
  return "yandex_corp";
}

function PresetHelp({ preset }: { preset: Preset }) {
  const t = useT();

  // Yandex corp gets a structured multi-step layout; everyone else gets a single body string.
  if (preset.key === "yandex_corp") {
    return (
      <div className="space-y-2">
        <p>
          <b>{t("help.yandex_corp.title")}</b>
        </p>
        <p>{t("help.yandex_corp.intro")}</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>{t("help.yandex_corp.step1")}</li>
          <li>{t("help.yandex_corp.step2")}</li>
          <li>{t("help.yandex_corp.step3")}</li>
        </ol>
        <p className="text-[11px] opacity-80">{t("help.yandex_corp.footer")}</p>
      </div>
    );
  }

  return <p>{t(`help.${preset.helpKey}.body`)}</p>;
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
