import { useState } from "react";
import { api } from "../lib/api";

export function DigestView() {
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await api.generateDigest();
      setBody(text);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Morning digest</h1>
            <p className="mt-1 text-sm text-muted">
              A summary of the last 24 hours of mail.
            </p>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate now"}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-3 bg-reply/10 border border-reply/40 text-sm rounded-md">
            {error}
          </div>
        )}

        {body && (
          <pre className="mt-6 whitespace-pre-wrap text-sm leading-relaxed font-sans bg-panel border border-border rounded-lg p-5">
            {body}
          </pre>
        )}

        {!body && !loading && !error && (
          <div className="mt-12 text-sm text-muted text-center">
            Click "Generate now" to produce a digest from the latest emails.
            A digest is also generated automatically each morning at the hour
            configured in Settings.
          </div>
        )}
      </div>
    </div>
  );
}
