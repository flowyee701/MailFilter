import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Inbox } from "./components/Inbox";
import { Settings } from "./components/Settings";
import { DigestView } from "./components/DigestView";
import { Onboarding } from "./components/Onboarding";
import { api } from "./lib/api";
import type { Category, CategoryCounts } from "./lib/types";

export type View =
  | { kind: "inbox"; category: Category | "all" }
  | { kind: "settings" }
  | { kind: "digest" };

type Boot = "checking" | "onboarding" | "ready";

export default function App() {
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

  // First-boot setup check: show Onboarding when something's missing.
  useEffect(() => {
    (async () => {
      try {
        const s = await api.setupStatus();
        const needsOnboarding =
          !s.ollama.running ||
          s.ollama.models.length === 0 ||
          !s.python_ok;
        setBoot(needsOnboarding ? "onboarding" : "ready");
      } catch {
        // Something went wrong; show the onboarding so the user has a path forward.
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
    setLastSyncMsg("Syncing…");
    try {
      const r = await api.syncInbox();
      setLastSyncMsg(
        `Fetched ${r.fetched}, new ${r.new}, classified ${r.classified}` +
          (r.errors.length ? `, ${r.errors.length} error(s)` : ""),
      );
      await refreshCounts();
    } catch (e) {
      setLastSyncMsg(`Sync failed: ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  }, [refreshCounts]);

  if (boot === "checking") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg text-muted text-sm">
        Starting…
      </div>
    );
  }

  if (boot === "onboarding") {
    return (
      <div className="flex h-full w-full bg-bg text-text">
        <Onboarding
          onFinish={async () => {
            // After onboarding, drop into Settings if email isn't configured yet,
            // otherwise straight to the inbox.
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
