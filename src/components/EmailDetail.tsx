import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "../lib/api";
import { CATEGORY_META, type Category, type EmailFull } from "../lib/types";
import { DraftModal } from "./DraftModal";
import { useT } from "../i18n";

interface Props {
  id: number;
  onMutated: () => void;
}

const CATEGORIES: Category[] = ["reply", "important", "event", "noise"];

export function EmailDetail({ id, onMutated }: Props) {
  const t = useT();
  const [email, setEmail] = useState<EmailFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const e = await api.getEmail(id);
      setEmail(e);
      if (!e.is_read) {
        await api.markRead(id, true);
        onMutated();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [id, onMutated]);

  useEffect(() => {
    load();
  }, [load]);

  const setCategory = async (cat: Category) => {
    if (!email || email.category === cat) return;
    await api.recategorize(email.id, cat);
    await load();
    onMutated();
  };

  const generateDraft = async () => {
    if (!email) return;
    setDraftLoading(true);
    try {
      await api.generateDraft(email.id);
      await load();
      setDraftOpen(true);
    } catch (e) {
      alert(t("email.draft_failed", { err: String(e) }));
    } finally {
      setDraftLoading(false);
    }
  };

  if (loading && !email) return <Centered>{t("app.loading")}</Centered>;
  if (error) return <Centered>{error}</Centered>;
  if (!email) return null;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border">
        <div className="text-lg font-semibold">{email.subject}</div>
        <div className="mt-1 text-sm text-muted">
          {t("email.from")}{" "}
          <span className="text-text">{email.from_name || email.from_addr}</span>{" "}
          <span>&lt;{email.from_addr}&gt;</span>
          <span className="mx-2">·</span>
          {new Date(email.received_at).toLocaleString()}
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">{t("email.category")}</span>
          {CATEGORIES.map((c) => {
            const active = email.category === c;
            const meta = CATEGORY_META[c];
            const label = t(meta.labelKey);
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs border transition-colors",
                  active
                    ? "bg-accent/20 text-accent border-accent/40"
                    : "bg-panel border-border text-muted hover:text-text",
                )}
                title={t("email.mark_as", { label })}
              >
                <span className="mr-1">{meta.icon}</span>
                {label}
              </button>
            );
          })}
          <span className="ml-2 text-[10px] text-muted">
            {t("email.confidence", { pct: (email.confidence * 100).toFixed(0) })}
          </span>

          <div className="ml-auto flex gap-2">
            {(email.category === "reply" || email.draft) && (
              <button
                onClick={email.draft ? () => setDraftOpen(true) : generateDraft}
                disabled={draftLoading}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:opacity-90 disabled:opacity-50"
              >
                {draftLoading
                  ? t("email.drafting")
                  : email.draft
                    ? t("email.view_draft")
                    : t("email.generate_draft")}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
          {email.body || email.snippet}
        </pre>
      </div>

      {draftOpen && email.draft && (
        <DraftModal
          subject={email.subject}
          to={email.from_addr}
          body={email.draft}
          onClose={() => setDraftOpen(false)}
          onRegenerate={async () => {
            setDraftLoading(true);
            try {
              await api.generateDraft(email.id);
              await load();
            } finally {
              setDraftLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center text-muted text-sm">
      {children}
    </div>
  );
}
