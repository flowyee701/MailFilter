import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Category, EmailRow } from "../lib/types";
import { CATEGORY_META } from "../lib/types";
import { EmailDetail } from "./EmailDetail";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";

interface Props {
  category: Category | "all";
  onMutated: () => void;
}

export function Inbox({ category, onMutated }: Props) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data =
        category === "all"
          ? await api.listEmails(20)
          : await api.listByCategory(category);
      setRows(data);
      if (data.length && selectedId == null) setSelectedId(data[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [category, selectedId]);

  useEffect(() => {
    setSelectedId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handleMutated = useCallback(async () => {
    await load();
    onMutated();
  }, [load, onMutated]);

  const grouped = groupByCategory(rows);
  const headerLabel =
    category === "all" ? "All mail" : CATEGORY_META[category].label;

  return (
    <div className="flex h-full">
      <section className="w-[420px] border-r border-border flex flex-col">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{headerLabel}</div>
            <div className="text-xs text-muted">
              {loading ? "Loading…" : `${rows.length} email(s)`}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {category === "all"
            ? (["reply", "important", "event", "noise"] as Category[]).map((c) => {
                const list = grouped[c];
                if (!list || list.length === 0) return null;
                return (
                  <CategoryGroup
                    key={c}
                    category={c}
                    rows={list}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                );
              })
            : rows.map((r) => (
                <EmailRowItem
                  key={r.id}
                  row={r}
                  selected={r.id === selectedId}
                  onClick={() => setSelectedId(r.id)}
                />
              ))}

          {!loading && rows.length === 0 && (
            <div className="p-8 text-center text-sm text-muted">
              No emails here. Try "Sync inbox" in the sidebar.
            </div>
          )}
        </div>
      </section>

      <section className="flex-1 min-w-0 bg-bg">
        {selectedId != null ? (
          <EmailDetail id={selectedId} onMutated={handleMutated} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted text-sm">
            Select an email to view
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryGroup({
  category,
  rows,
  selectedId,
  onSelect,
}: {
  category: Category;
  rows: EmailRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const meta = CATEGORY_META[category];
  return (
    <div>
      <div className="px-4 py-1.5 bg-panel/60 border-y border-border text-xs uppercase tracking-wider text-muted flex items-center gap-2 sticky top-0">
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        <span className="ml-auto text-[10px]">{rows.length}</span>
      </div>
      {rows.map((r) => (
        <EmailRowItem
          key={r.id}
          row={r}
          selected={r.id === selectedId}
          onClick={() => onSelect(r.id)}
        />
      ))}
    </div>
  );
}

function EmailRowItem({
  row,
  selected,
  onClick,
}: {
  row: EmailRow;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = CATEGORY_META[row.category];
  const fromLabel = row.from_name || row.from_addr;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left px-4 py-3 border-b border-border/60 block",
        selected ? "bg-panel2" : "hover:bg-panel/60",
        !row.is_read && "border-l-2 border-l-accent",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={clsx("text-xs", meta.color)}>{meta.icon}</span>
        <span className="text-sm font-medium truncate flex-1">{fromLabel}</span>
        <span className="text-[10px] text-muted shrink-0">
          {safeDistance(row.received_at)}
        </span>
      </div>
      <div className="text-sm mt-0.5 truncate">{row.subject}</div>
      <div className="text-xs text-muted mt-0.5 line-clamp-2">{row.snippet}</div>
      {row.is_draft_generated && (
        <div className="mt-1 text-[10px] text-accent">✓ draft ready</div>
      )}
    </button>
  );
}

function groupByCategory(rows: EmailRow[]): Record<Category, EmailRow[]> {
  const out: Record<Category, EmailRow[]> = {
    reply: [],
    important: [],
    event: [],
    noise: [],
  };
  for (const r of rows) out[r.category]?.push(r);
  return out;
}

function safeDistance(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: false });
  } catch {
    return "";
  }
}
