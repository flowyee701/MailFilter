import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Inbox } from "./components/Inbox";
import { Settings } from "./components/Settings";
import { DigestView } from "./components/DigestView";
import { api } from "./lib/api";
import type { Category, CategoryCounts } from "./lib/types";

export type View =
  | { kind: "inbox"; category: Category | "all" }
  | { kind: "settings" }
  | { kind: "digest" };

export default function App() {
  const [view, setView] = useState<View>({ kind: "inbox", category: "reply" });
  const [counts, setCounts] = useState<CategoryCounts>({
    reply: 0,
    important: 0,
    event: 0,
    noise: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMsg, setLastSyncMsg] = useState<string>("");

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await api.categoryCounts());
    } catch (e) {
      console.error("counts failed", e);
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

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

  return (
    <div className="flex h-full w-full bg-bg text-text">
      <Sidebar
        view={view}
        counts={counts}
        onNavigate={setView}
        onSync={doSync}
        syncing={syncing}
        lastSyncMsg={lastSyncMsg}
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
