import clsx from "clsx";
import type { View } from "../App";
import { CATEGORY_META, type Category, type CategoryCounts } from "../lib/types";

interface Props {
  view: View;
  counts: CategoryCounts;
  onNavigate: (v: View) => void;
  onSync: () => void;
  syncing: boolean;
  lastSyncMsg: string;
}

const CATEGORIES: Category[] = ["reply", "important", "event", "noise"];

export function Sidebar({ view, counts, onNavigate, onSync, syncing, lastSyncMsg }: Props) {
  const isActive = (cat: Category | "all") =>
    view.kind === "inbox" && view.category === cat;

  return (
    <aside className="w-64 flex flex-col bg-panel border-r border-border">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-lg font-semibold tracking-tight">MailMind</div>
        <div className="text-xs text-muted">Local-first email triage</div>
      </div>

      <div className="px-3 py-3">
        <button
          onClick={onSync}
          disabled={syncing}
          className={clsx(
            "w-full rounded-md px-3 py-2 text-sm font-medium",
            "bg-accent text-white hover:opacity-90 disabled:opacity-50",
          )}
        >
          {syncing ? "Syncing…" : "Sync inbox"}
        </button>
        {lastSyncMsg && (
          <div className="mt-2 text-xs text-muted truncate" title={lastSyncMsg}>
            {lastSyncMsg}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <SectionLabel>Categories</SectionLabel>
        <NavRow
          label="All mail"
          icon="📥"
          active={isActive("all")}
          onClick={() => onNavigate({ kind: "inbox", category: "all" })}
        />
        {CATEGORIES.map((c) => (
          <NavRow
            key={c}
            label={CATEGORY_META[c].label}
            icon={CATEGORY_META[c].icon}
            badge={counts[c]}
            active={isActive(c)}
            onClick={() => onNavigate({ kind: "inbox", category: c })}
          />
        ))}

        <SectionLabel>Tools</SectionLabel>
        <NavRow
          label="Morning digest"
          icon="☕"
          active={view.kind === "digest"}
          onClick={() => onNavigate({ kind: "digest" })}
        />
        <NavRow
          label="Settings"
          icon="⚙️"
          active={view.kind === "settings"}
          onClick={() => onNavigate({ kind: "settings" })}
        />
      </nav>

      <div className="px-4 py-3 border-t border-border text-[11px] text-muted">
        100% local · Ollama + IMAP
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted">
      {children}
    </div>
  );
}

function NavRow({
  label,
  icon,
  badge,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  badge?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
        active ? "bg-panel2 text-text" : "text-muted hover:bg-panel2 hover:text-text",
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="bg-accent/20 text-accent text-xs font-medium rounded px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </button>
  );
}
