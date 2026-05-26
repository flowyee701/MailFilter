import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api } from "../lib/api";
import type { PullProgress, SetupStatus } from "../lib/types";
import { useT } from "../i18n";

interface ModelOption {
  id: string;
  label: string;
  size: string;
  recommended?: boolean;
  noteKey: string;
}

// Note: model labels & sizes stay as-is (they're brand names / numeric specs);
// only the descriptive note is translated per locale.
const MODEL_CATALOG: ModelOption[] = [
  {
    id: "qwen2.5:3b",
    label: "Qwen 2.5 (3B)",
    size: "~1.9 GB",
    recommended: true,
    noteKey: "model.note.qwen",
  },
  {
    id: "llama3.2:3b",
    label: "Llama 3.2 (3B)",
    size: "~2.0 GB",
    noteKey: "model.note.llama",
  },
  {
    id: "mistral",
    label: "Mistral 7B",
    size: "~4.4 GB",
    noteKey: "model.note.mistral",
  },
];

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

interface Props {
  onFinish: () => void;
}

export function Onboarding({ onFinish }: Props) {
  const t = useT();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("qwen2.5:3b");
  const [pull, setPull] = useState<PullProgress | null>(null);
  const unlistenRef = useRef<null | (() => void)>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.setupStatus();
      setStatus(s);
      if (s.ollama.models.includes(s.model_in_settings)) {
        setSelectedModel(s.model_in_settings);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    let cancelled = false;
    api
      .onPullProgress((p) => {
        if (cancelled) return;
        setPull(p);
        if (p.done) refresh();
      })
      .then((un) => {
        unlistenRef.current = un;
      });
    return () => {
      cancelled = true;
      if (unlistenRef.current) unlistenRef.current();
    };
  }, [refresh]);

  if (loading || !status) {
    return (
      <div className="h-full flex items-center justify-center text-muted">
        {t("app.loading")}
      </div>
    );
  }

  const ollamaOk = status.ollama.running;
  const hasAnyModel = status.ollama.models.length > 0;
  const modelChosenIsInstalled =
    selectedModel.length > 0 && status.ollama.models.includes(selectedModel);
  const pythonOk = status.python_ok;
  const allGreen = ollamaOk && hasAnyModel && pythonOk;

  const installOllama = async () => {
    await api.openExternal(OLLAMA_DOWNLOAD_URL);
  };

  const startOllama = async () => {
    setBusy("ollama");
    try {
      await api.ollamaTryStart();
      await new Promise((r) => setTimeout(r, 2500));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const pullModel = async () => {
    setBusy("model");
    setPull({
      model: selectedModel,
      status: t("onboarding.step2.starting"),
      completed: 0,
      total: 0,
      percent: 0,
      done: false,
      error: null,
    });
    try {
      const settings = await api.loadSettings();
      await api.saveSettings({ ...settings, model: selectedModel, password: undefined });
      await api.ollamaPullModel(selectedModel);
    } catch (e) {
      setPull({
        model: selectedModel,
        status: "failed",
        completed: 0,
        total: 0,
        percent: 0,
        done: true,
        error: String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  const step2OkText = modelChosenIsInstalled
    ? t("onboarding.step2.selected", { model: selectedModel })
    : t("onboarding.step2.installed_list", {
        list:
          status.ollama.models.slice(0, 3).join(", ") +
          (status.ollama.models.length > 3 ? "…" : ""),
      });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="text-center mb-8">
          <div className="text-3xl font-semibold tracking-tight">
            {t("onboarding.welcome")}
          </div>
          <p className="mt-2 text-sm text-muted">{t("onboarding.subtitle")}</p>
        </div>

        {/* Step 1 — Ollama */}
        <Step
          number={1}
          title={t("onboarding.step1.title")}
          ok={ollamaOk}
          okText={t("onboarding.step1.ok")}
        >
          {!ollamaOk && (
            <>
              {!status.ollama.app_installed && !status.ollama.cli_installed && (
                <>
                  <p className="text-sm text-muted">
                    {t("onboarding.step1.desc_missing")}
                  </p>
                  <Action onClick={installOllama}>
                    {t("onboarding.step1.btn_download")}
                  </Action>
                  <p className="text-xs text-muted">{t("onboarding.step1.hint")}</p>
                  <SecondaryButton onClick={refresh}>{t("common.recheck")}</SecondaryButton>
                </>
              )}
              {(status.ollama.app_installed || status.ollama.cli_installed) && (
                <>
                  <p className="text-sm text-muted">
                    {t("onboarding.step1.desc_stopped")}
                  </p>
                  <Action onClick={startOllama} disabled={busy === "ollama"}>
                    {busy === "ollama"
                      ? t("onboarding.step1.starting")
                      : t("onboarding.step1.btn_start")}
                  </Action>
                </>
              )}
            </>
          )}
        </Step>

        {/* Step 2 — Model */}
        <Step
          number={2}
          title={t("onboarding.step2.title")}
          ok={hasAnyModel}
          okText={step2OkText}
          disabled={!ollamaOk}
        >
          {ollamaOk && (
            <>
              <div className="space-y-2">
                {MODEL_CATALOG.map((m) => {
                  const installed = status.ollama.models.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={clsx(
                        "flex items-start gap-3 p-3 rounded-md border cursor-pointer",
                        selectedModel === m.id
                          ? "border-accent bg-accent/5"
                          : "border-border hover:bg-panel/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={m.id}
                        checked={selectedModel === m.id}
                        onChange={() => setSelectedModel(m.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {m.label}
                          {m.recommended && (
                            <span className="text-[10px] bg-accent/20 text-accent rounded px-1.5 py-0.5">
                              {t("onboarding.step2.tag_recommended")}
                            </span>
                          )}
                          {installed && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">
                              {t("onboarding.step2.tag_installed")}
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-muted">
                            {m.size}
                          </span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          {/* Falls back to English-ish baked-in description if locale didn't define it. */}
                          {t(m.noteKey)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {!modelChosenIsInstalled && (
                <Action onClick={pullModel} disabled={pull !== null && !pull.done}>
                  {pull && !pull.done
                    ? t("onboarding.step2.downloading")
                    : t("onboarding.step2.btn_download", { model: selectedModel })}
                </Action>
              )}
              {modelChosenIsInstalled && (
                <p className="text-xs text-muted">
                  {t("onboarding.step2.already", { model: selectedModel })}
                </p>
              )}

              {pull && (
                <div className="mt-3 p-3 bg-panel/40 border border-border rounded-md">
                  <div className="text-xs text-muted">
                    {pull.status}
                    {pull.total > 0 && (
                      <span className="ml-2">
                        {(pull.completed / 1e6).toFixed(0)} /{" "}
                        {(pull.total / 1e6).toFixed(0)} MB
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 bg-bg rounded overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${Math.min(100, pull.percent)}%` }}
                    />
                  </div>
                  {pull.error && (
                    <div className="mt-2 text-xs text-reply">{pull.error}</div>
                  )}
                </div>
              )}
            </>
          )}
        </Step>

        {/* Step 3 — Python */}
        <Step
          number={3}
          title={t("onboarding.step3.title")}
          ok={pythonOk}
          okText={t("onboarding.step3.ok")}
        >
          {!pythonOk && (
            <>
              <p className="text-sm text-muted">
                {t("onboarding.step3.desc_missing")}
              </p>
              <Action
                onClick={() =>
                  api.openExternal("https://www.python.org/downloads/macos/")
                }
              >
                {t("onboarding.step3.btn_download")}
              </Action>
              <SecondaryButton onClick={refresh}>{t("common.recheck")}</SecondaryButton>
            </>
          )}
        </Step>

        <div className="mt-10 flex items-center gap-2">
          <button
            onClick={onFinish}
            disabled={!allGreen}
            className={clsx(
              "px-5 py-2 rounded-md text-sm font-medium",
              allGreen
                ? "bg-accent text-white hover:opacity-90"
                : "bg-panel2 text-muted cursor-not-allowed",
            )}
          >
            {status.imap_configured
              ? t("onboarding.btn_open_app")
              : t("onboarding.btn_continue_email")}
          </button>
          <button
            onClick={onFinish}
            className="px-4 py-2 rounded-md text-sm text-muted hover:text-text"
          >
            {t("common.skip")}
          </button>
          <button
            onClick={refresh}
            className="ml-auto px-3 py-2 rounded-md text-xs text-muted hover:text-text"
          >
            {t("common.recheck_status")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  ok,
  okText,
  disabled,
  children,
}: {
  number: number;
  title: string;
  ok: boolean;
  okText?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={clsx(
        "mb-4 rounded-lg border bg-panel/40",
        disabled ? "border-border/40 opacity-60" : "border-border",
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <span
          className={clsx(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
            ok ? "bg-green-500/20 text-green-400" : "bg-panel2 text-muted",
          )}
        >
          {ok ? "✓" : number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          {ok && okText && (
            <div className="text-xs text-muted truncate">{okText}</div>
          )}
        </div>
      </header>
      {!ok && children && <div className="px-4 py-3 space-y-2">{children}</div>}
    </section>
  );
}

function Action({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-md text-sm font-medium bg-accent text-white hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="ml-2 px-3 py-2 rounded-md text-xs text-muted hover:text-text"
    >
      {children}
    </button>
  );
}
