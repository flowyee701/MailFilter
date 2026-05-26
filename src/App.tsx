import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Inbox } from "./components/Inbox";
import { Settings } from "./components/Settings";
import { DigestView } from "./components/DigestView";
import { Onboarding } from "./components/Onboarding";
import { api } from "./lib/api";
import type { Category, CategoryCounts } from "./lib/types";
import { I18nProvider, useT, type Lang } from "./i18n";

export type View =
  | { kind: "inbox"; category: Category | "all" }
  | { kind: "settings" }
  | { kind: "digest" };

type Boot = "checking" | "onboarding" | "ready";

export default function App() {
  // Load the user's stored language preference before mounting the rest of the
  // UI, so the first frame is in the right language. While that round-trip is
  // in flight we show a tiny "starting" splash.
  const [initialLang, setInitialLang] = useState<Lang | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.loadSettings();
        const code = (s.language || "").toLowerCase();
        const valid: Lang[] = ["en", "ru", "fr", "de", "zh"];
        const lang = (valid as string[]).includes(code) ? (code as Lang) : null;
        setInitialLang(lang ?? detectFromBrowser());
      } catch {
        setInitialLang(detectFromBrowser());
      }
    })();
  }, []);

  if (!initialLang) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg text-muted text-sm">
        Starting…
      </div>
    );
  }

  return (
    <I18nProvider
      initialLang={initialLang}
      onLangChange={async (next) => {
        // Persist immediately on every change.
        try {
          const s = await api.loadSettings();
          await api.saveSettings({ ...s, language: next, password: undefined });
        } catch (e) {
          console.error("failed to persist language", e);
        }
      }}
    >
      <AppInner />
    </I18nProvider>
  );
}

function detectFromBrowser(): Lang {
  const raw = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("zh")) return "zh";
  return "en";
}

function AppInner() {
  const t = useT();
  const [boot, setBoot] = useState<Boot>("checking");
  const [view, setView] = useState<View>({ kind: "inbox", category: "reply" });
  const [counts, setCounts] = useState<CategoryCounts>({
    reply: 0,
    important: 0,
    event: 0,
    noise: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMsg, setLastSyncMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const s = await api.setupStatus();
        const needs =
          !s.ollama.running || s.ollama.models.length === 0 || !s.python_ok;
        setBoot(needs ? "onboarding" : "ready");
      } catch {
        setBoot("onboarding");
      }
    })();
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await api.categoryCounts());
    } catch (e) {
      console.error("counts failed", e);
    }
  }, []);

  useEffect(() => {
    if (boot === "ready") refreshCounts();
  }, [boot, refreshCounts]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    setLastSyncMsg(t("sidebar.syncing"));
    try {
      const r = await api.syncInbox();
      let msg = t("sidebar.sync_result", {
        fetched: r.fetched,
        n: r.new,
        c: r.classified,
      });
      if (r.errors.length) msg += t("sidebar.sync_errors", { n: r.errors.length });
      setLastSyncMsg(msg);
      await refreshCounts();
    } catch (e) {
      setLastSyncMsg(t("sidebar.sync_failed", { err: String(e) }));
    } finally {
      setSyncing(false);
    }
  }, [refreshCounts, t]);

  if (boot === "checking") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg text-muted text-sm">
        {t("app.starting")}
      </div>
    );
  }

  if (boot === "onboarding") {
    return (
      <div className="flex h-full w-full bg-bg text-text">
        <Onboarding
          onFinish={async () => {
            try {
              const s = await api.setupStatus();
              setView(
                s.imap_configured
                  ? { kind: "inbox", category: "reply" }
                  : { kind: "settings" },
              );
            } catch {
              setView({ kind: "settings" });
            }
            setBoot("ready");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-bg text-text">
      <Sidebar
        view={view}
        counts={counts}
        onNavigate={setView}
        onSync={doSync}
        syncing={syncing}
        lastSyncMsg={lastSyncMsg}
        onReRunSetup={() => setBoot("onboarding")}
      />
      <main className="flex-1 min-w-0 overflow-hidden">
        {view.kind === "inbox" && (
          <Inbox category={view.category} onMutated={refreshCounts} />
        )}
        {view.kind === "settings" && <Settings />}
        {view.kind === "digest" && <DigestView />}
      </main>
    </div>
  );
}
