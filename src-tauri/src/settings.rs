use anyhow::{Context, Result};
use keyring::Entry;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const SERVICE: &str = "MailMind";
const PASSWORD_KEY: &str = "imap_password";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub imap_host: String,
    pub imap_port: u16,
    pub login: String,
    /// Only used in-memory when sending/saving. Persisted in OS keychain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default = "default_mailbox")]
    pub mailbox: String,
    #[serde(default = "default_fetch_limit")]
    pub fetch_limit: u32,
    #[serde(default = "default_ollama_url")]
    pub ollama_url: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_digest_hour")]
    pub digest_hour: u32,
    #[serde(default = "default_retention_days")]
    pub retention_days: u32,
    /// UI language code: "en", "ru", "fr", "de", "zh". Empty/missing = autodetect on frontend.
    #[serde(default)]
    pub language: String,
}

fn default_mailbox() -> String { "INBOX".into() }
fn default_fetch_limit() -> u32 { 20 }
fn default_ollama_url() -> String { "http://127.0.0.1:11434".into() }
fn default_model() -> String { "mistral".into() }
fn default_digest_hour() -> u32 { 8 }
fn default_retention_days() -> u32 { 30 }

impl Settings {
    pub fn defaults_yandex() -> Self {
        Self {
            imap_host: "imap.yandex.com".into(),
            imap_port: 993,
            login: String::new(),
            password: None,
            mailbox: default_mailbox(),
            fetch_limit: default_fetch_limit(),
            ollama_url: default_ollama_url(),
            model: default_model(),
            digest_hour: default_digest_hour(),
            retention_days: default_retention_days(),
            language: String::new(),
        }
    }
}

pub fn save(conn: &Connection, mut s: Settings) -> Result<()> {
    // Stash password in keychain, blank it from the row written to sqlite.
    if let Some(pw) = s.password.take() {
        if !pw.is_empty() {
            let entry = Entry::new(SERVICE, PASSWORD_KEY)
                .context("keychain entry init failed")?;
            entry.set_password(&pw).context("keychain write failed")?;
        }
    }
    let json = serde_json::to_string(&s)?;
    conn.execute(
        "INSERT INTO settings(key, value) VALUES('app', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![json],
    )?;
    Ok(())
}

pub fn load(conn: &Connection) -> Result<Settings> {
    let mut s: Settings = conn
        .query_row(
            "SELECT value FROM settings WHERE key='app'",
            [],
            |row| {
                let v: String = row.get(0)?;
                Ok(v)
            },
        )
        .ok()
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_else(Settings::defaults_yandex);

    // Hydrate password from keychain when caller asks for it (load_with_password).
    s.password = None;
    Ok(s)
}

pub fn load_with_password(conn: &Connection) -> Result<Settings> {
    let mut s = load(conn)?;
    if let Ok(entry) = Entry::new(SERVICE, PASSWORD_KEY) {
        if let Ok(pw) = entry.get_password() {
            s.password = Some(pw);
        }
    }
    Ok(s)
}
