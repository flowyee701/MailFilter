export type Category = "reply" | "important" | "event" | "noise";

export interface EmailRow {
  id: number;
  uid: string;
  from_addr: string;
  from_name: string | null;
  subject: string;
  snippet: string;
  received_at: string;
  category: Category;
  confidence: number;
  is_read: boolean;
  is_draft_generated: boolean;
}

export interface EmailFull extends EmailRow {
  body: string;
  draft: string | null;
}

export interface Settings {
  imap_host: string;
  imap_port: number;
  login: string;
  password?: string;
  mailbox: string;
  fetch_limit: number;
  ollama_url: string;
  model: string;
  digest_hour: number;
  retention_days: number;
}

export interface SyncSummary {
  fetched: number;
  new: number;
  classified: number;
  errors: string[];
}

export interface CategoryCounts {
  reply: number;
  important: number;
  event: number;
  noise: number;
}

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  reply:     { label: "Requires reply", icon: "🔴", color: "text-reply" },
  important: { label: "Important",      icon: "🟡", color: "text-important" },
  event:     { label: "Events",         icon: "📅", color: "text-event" },
  noise:     { label: "Noise",          icon: "🗑️", color: "text-noise" },
};
