import clsx from "clsx";
import type { View } from "../App";
import { CATEGORY_META, type Category, type CategoryCounts } from "../lib/types";
import { useT } from "../i18n";

interface Props {
  view: View;
  counts: CategoryCounts;
  onNavigate: (v: View) => void;
  onSync: () => void;
  syncing: boolean;
  lastSyncMsg: string;
  onReRunSetup?: () => void;
}

const CATEGORIES: Category[] = ["reply", "important", "event", "noise"];

export function Sidebar({
  view,
  counts,
  onNavigate,
  onSync,
  syncing,
  lastSyncMsg,
  onReRunSetup,
}: Props) {
  const t = useT();
  const isActive = (cat: Category | "all") =>
    view.kind === "inbox" && view.category === cat;

  return (
    <aside className="w-64 flex flex-col bg-panel border-r border-border">
      <div className="px-5 py-4 border-b border-border">
        <div className="text-lg font-semibold tracking-tight">{t("app.name")}</div>
        <div className="text-xs text-muted">{t("app.tagline")}</div>
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
          {syncing ? t("sidebar.syncing") : t("sidebar.sync")}
        </button>
        {lastSyncMsg && (
          <div className="mt-2 text-xs text-muted truncate" title={lastSyncMsg}>
            {lastSyncMsg}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <SectionLabel>{t("sidebar.categories")}</SectionLabel>
        <NavRow
          label={t("sidebar.all_mail")}
          icon="📥"
          active={isActive("all")}
          onClick={() => onNavigate({ kind: "inbox", category: "all" })}
        />
        {CATEGORIES.map((c) => (
          <NavRow
            key={c}
            label={t(CATEGORY_META[c].labelKey)}
            icon={CATEGORY_META[c].icon}
            badge={counts[c]}
            active={isActive(c)}
            onClick={() => onNavigate({ kind: "inbox", category: c })}
          />
        ))}

        <SectionLabel>{t("sidebar.tools")}</SectionLabel>
        <NavRow
          label={t("sidebar.morning_digest")}
          icon="☕"
          active={view.kind === "digest"}
          onClick={() => onNavigate({ kind: "digest" })}
        />
        <NavRow
          label={t("sidebar.settings")}
          icon="⚙️"
          active={view.kind === "settings"}
          onClick={() => onNavigate({ kind: "settings" })}
        />
        {onReRunSetup && (
          <NavRow
            label={t("sidebar.rerun_setup")}
            icon="🛠️"
            onClick={onReRunSetup}
          />
        )}
      </nav>

      <div className="px-4 py-3 border-t border-border text-[11px] text-muted">
        {t("sidebar.footer")}
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
