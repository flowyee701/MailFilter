import { useState } from "react";
import { useT } from "../i18n";

interface Props {
  subject: string;
  to: string;
  body: string;
  onClose: () => void;
  onRegenerate: () => Promise<void>;
}

export function DraftModal({ subject, to, body, onClose, onRegenerate }: Props) {
  const t = useT();
  const [text, setText] = useState(body);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-border rounded-lg w-[640px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t("draft.title")}</div>
            <div className="text-xs text-muted">
              {t("draft.to_re", { to, subject })}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text text-lg">
            ×
          </button>
        </header>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 px-5 py-4 bg-bg text-sm leading-relaxed resize-none focus:outline-none"
          rows={16}
        />
        <footer className="px-5 py-3 border-t border-border flex items-center gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRegenerate();
              } finally {
                setBusy(false);
              }
            }}
            className="px-3 py-1.5 rounded-md text-xs bg-panel2 text-text hover:bg-panel2/70 disabled:opacity-50"
          >
            {busy ? t("common.regenerating") : t("common.regenerate")}
          </button>
          <div className="flex-1" />
          <button
            onClick={copy}
            className="px-3 py-1.5 rounded-md text-xs bg-accent text-white hover:opacity-90"
          >
            {t("common.copy")}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs bg-panel2 text-text hover:bg-panel2/70"
          >
            {t("common.close")}
          </button>
        </footer>
      </div>
    </div>
  );
}
