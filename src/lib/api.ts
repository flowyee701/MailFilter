import { invoke } from "@tauri-apps/api/tauri";
import type {
  Category,
  CategoryCounts,
  EmailFull,
  EmailRow,
  Settings,
  SyncSummary,
} from "./types";

export const api = {
  loadSettings: () => invoke<Settings>("load_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  testConnection: () => invoke<boolean>("test_connection"),

  syncInbox: () => invoke<SyncSummary>("sync_inbox"),

  listEmails: (limit?: number) => invoke<EmailRow[]>("list_emails", { limit }),
  listByCategory: (category: Category) =>
    invoke<EmailRow[]>("list_emails_by_category", { category }),
  categoryCounts: () => invoke<CategoryCounts>("category_counts"),

  getEmail: (id: number) => invoke<EmailFull>("get_email", { id }),
  recategorize: (id: number, newCategory: Category) =>
    invoke<void>("recategorize_email", { id, newCategory }),
  markRead: (id: number, read: boolean) => invoke<void>("mark_read", { id, read }),

  generateDraft: (id: number) => invoke<string>("generate_draft", { id }),
  generateDigest: () => invoke<string>("generate_digest"),
};
