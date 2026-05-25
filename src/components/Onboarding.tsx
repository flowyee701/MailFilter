import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api } from "../lib/api";
import type { PullProgress, SetupStatus } from "../lib/types";

interface ModelOption {
  id: string;
  label: string;
  size: string;
  recommended?: boolean;
  note: string;
}

const MODEL_CATALOG: ModelOption[] = [
  {
    id: "qwen2.5:3b",
    label: "Qwen 2.5 (3B)",
    size: "~1.9 GB",
    recommended: true,
    note: "Best speed/accuracy trade-off on Apple Silicon. Recommended.",
  },
  {
    id: "llama3.2:3b",
    label: "Llama 3.2 (3B)",
    size: "~2.0 GB",
    note: "Strong alternative to Qwen. English-focused.",
  },
  {
    id: "mistral",
    label: "Mistral 7B",
    size: "~4.4 GB",
    note: "Larger, slower, sometimes more nuanced. Heavier on the fans.",
  },
];

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

interface Props {
  onFinish: () => void;
}

export function Onboarding({ onFinish }: Props) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // which step is "working"
  const [selectedModel, setSelectedModel] = useState<string>("qwen2.5:3b");
  const [pull, setPull] = useState<PullProgress | null>(null);
  const unlistenRef = useRef<null | (() => void)>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.setupStatus();
      setStatus(s);
      // If user previously chose a model that's already pulled, prefer it.
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
    api.onPullProgress((p) => {
      if (cancelled) return;
      setPull(p);
      if (p.done) {
        refresh();
      }
    }).then((un) => {
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
        Loading…
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
      // Give it a moment, then refresh.
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
      status: "starting…",
      completed: 0,
      total: 0,
      percent: 0,
      done: false,
      error: null,
    });
    try {
      // Persist choice so subsequent classifies use it.
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
      // Pull is async-streamed; busy released by event handler when done.
      // But re-allow user to do other steps in parallel:
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="text-center mb-8">
          <div className="text-3xl font-semibold tracking-tight">
            Welcome to MailMind
          </div>
          <p className="mt-2 text-sm text-muted">
            Local-first email triage. Let's get the few pieces in place.
            Everything below runs on your Mac — nothing leaves it.
          </p>
        </div>

        {/* Step 1 — Ollama */}
        <Step
          number={1}
          title="Ollama (local AI runtime)"
          ok={ollamaOk}
          okText="Running on http://127.0.0.1:11434"
        >
          {!ollamaOk && (
            <>
              {!status.ollama.app_installed && !status.ollama.cli_installed && (
                <>
                  <p className="text-sm text-muted">
                    Ollama is what runs the language model on your Mac. It's a
                    free, open-source app from <span className="font-mono">ollama.com</span>.
                  </p>
                  <Action onClick={installOllama}>
                    Download Ollama (opens browser) →
                  </Action>
                  <p className="text-xs text-muted">
                    After installing Ollama from the .dmg and opening it once,
                    come back here and click <i>Re-check</i>.
                  </p>
                  <SecondaryButton onClick={refresh}>Re-check</SecondaryButton>
                </>
              )}
              {(status.ollama.app_installed || status.ollama.cli_installed) && (
                <>
                  <p className="text-sm text-muted">
                    Ollama is installed but the background service isn't running yet.
                  </p>
                  <Action onClick={startOllama} disabled={busy === "ollama"}>
                    {busy === "ollama" ? "Starting…" : "Start Ollama"}
                  </Action>
                </>
              )}
            </>
          )}
        </Step>

        {/* Step 2 — Model */}
        <Step
          number={2}
          title="Pick a model and download it"
          ok={hasAnyModel}
          okText={
            modelChosenIsInstalled
              ? `Selected: ${selectedModel}`
              : `Installed: ${status.ollama.models.slice(0, 3).join(", ")}${
                  status.ollama.models.length > 3 ? "…" : ""
                }`
          }
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
                              recommended
                            </span>
                          )}
                          {installed && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">
                              installed
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-muted">
                            {m.size}
                          </span>
                        </div>
                        <div className="text-xs text-muted mt-0.5">{m.note}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {!modelChosenIsInstalled && (
                <Action onClick={pullModel} disabled={pull !== null && !pull.done}>
                  {pull && !pull.done
                    ? "Downloading…"
                    : `Download ${selectedModel}`}
                </Action>
              )}
              {modelChosenIsInstalled && (
                <p className="text-xs text-muted">
                  ✓ {selectedModel} is already pulled. You can change models any
                  time in Settings → Ollama.
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

        {/* Step 3 — Python (informational only) */}
        <Step
          number={3}
          title="Python runtime"
          ok={pythonOk}
          okText="Auto-configured in ~/Library/Application Support/MailMind"
        >
          {!pythonOk && (
            <>
              <p className="text-sm text-muted">
                MailMind couldn't find a working Python 3. macOS usually ships
                with one — if not, install it once via the official installer
                or Homebrew.
              </p>
              <Action onClick={() => api.openExternal("https://www.python.org/downloads/macos/")}>
                Download Python (opens browser) →
              </Action>
              <SecondaryButton onClick={refresh}>Re-check</SecondaryButton>
            </>
          )}
        </Step>

        {/* Footer */}
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
              ? "Open MailMind →"
              : "Continue to email setup →"}
          </button>
          <button
            onClick={onFinish}
            className="px-4 py-2 rounded-md text-sm text-muted hover:text-text"
          >
            Skip for now
          </button>
          <button
            onClick={refresh}
            className="ml-auto px-3 py-2 rounded-md text-xs text-muted hover:text-text"
          >
            Re-check status
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
      {!ok && children && (
        <div className="px-4 py-3 space-y-2">{children}</div>
      )}
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
