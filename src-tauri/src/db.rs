use anyhow::Result;
use rusqlite::{Connection, params};
use std::path::PathBuf;

pub fn db_path() -> PathBuf {
    let mut p = dirs::data_local_dir().unwrap_or_else(|| std::env::temp_dir());
    p.push("MailMind");
    let _ = std::fs::create_dir_all(&p);
    p.push("mailmind.db");
    p
}

pub fn init() -> Result<Connection> {
    let conn = Connection::open(db_path())?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS emails (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            uid         TEXT UNIQUE NOT NULL,
            message_id  TEXT,
            from_addr   TEXT NOT NULL,
            from_name   TEXT,
            to_addr     TEXT,
            subject     TEXT NOT NULL,
            body        TEXT,
            snippet     TEXT,
            received_at TEXT NOT NULL,
            category    TEXT NOT NULL DEFAULT 'noise',
            confidence  REAL DEFAULT 0,
            is_read     INTEGER NOT NULL DEFAULT 0,
            is_draft_generated INTEGER NOT NULL DEFAULT 0,
            user_corrected INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
        CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);

        CREATE TABLE IF NOT EXISTS drafts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email_id   INTEGER NOT NULL UNIQUE,
            body       TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS corrections (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            subject    TEXT NOT NULL,
            snippet    TEXT NOT NULL,
            from_addr  TEXT,
            old_category TEXT NOT NULL,
            new_category TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS digests (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            day       TEXT NOT NULL UNIQUE,
            body      TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        "#,
    )?;
    Ok(conn)
}

pub fn purge_older_than_days(conn: &Connection, days: i64) -> Result<usize> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
    let n = conn.execute(
        "DELETE FROM emails WHERE received_at < ?1 AND user_corrected = 0",
        params![cutoff.to_rfc3339()],
    )?;
    Ok(n)
}
