use crate::{db, ollama, python, settings, AppState};
use tauri::AppHandle;
use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailRow {
    pub id: i64,
    pub uid: String,
    pub from_addr: String,
    pub from_name: Option<String>,
    pub subject: String,
    pub snippet: String,
    pub received_at: String,
    pub category: String,
    pub confidence: f64,
    pub is_read: bool,
    pub is_draft_generated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailFull {
    #[serde(flatten)]
    pub row: EmailRow,
    pub body: String,
    pub draft: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchedEmail {
    pub uid: String,
    pub message_id: Option<String>,
    pub from_addr: String,
    pub from_name: Option<String>,
    pub to_addr: Option<String>,
    pub subject: String,
    pub body: String,
    pub snippet: String,
    pub received_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchResult {
    pub ok: bool,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub emails: Vec<FetchedEmail>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClassificationResult {
    pub category: String,
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncSummary {
    pub fetched: usize,
    pub new: usize,
    pub classified: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupStatus {
    pub ollama: ollama::Diagnostics,
    pub imap_configured: bool,
    pub model_in_settings: String,
    pub python_ok: bool,
}

#[tauri::command]
pub fn setup_status(state: State<AppState>) -> Result<SetupStatus, String> {
    let s = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        settings::load(&conn).map_err(|e| e.to_string())?
    };
    let ollama = ollama::diagnose(&s.ollama_url);
    let imap_configured = !s.login.is_empty() && !s.imap_host.is_empty();
    let python_ok = python::bootstrap().is_ok();
    Ok(SetupStatus {
        ollama,
        imap_configured,
        model_in_settings: s.model,
        python_ok,
    })
}

#[tauri::command]
pub fn ollama_try_start() -> Result<bool, String> {
    Ok(ollama::try_start())
}

#[tauri::command]
pub fn ollama_pull_model(handle: AppHandle, state: State<AppState>, model: String) -> Result<(), String> {
    let url = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        settings::load(&conn).map_err(|e| e.to_string())?.ollama_url
    };
    ollama::pull_model(handle, &url, &model);
    Ok(())
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: settings::Settings) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    settings::save(&conn, settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_settings(state: State<AppState>) -> Result<settings::Settings, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    settings::load(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn test_connection(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let s = settings::load_with_password(&conn).map_err(|e| e.to_string())?;
    let payload = json!({
        "host": s.imap_host,
        "port": s.imap_port,
        "login": s.login,
        "password": s.password.unwrap_or_default(),
        "mailbox": s.mailbox,
        "test": true,
    });
    let r: serde_json::Value = python::run_script("fetch_emails.py", &payload)
        .map_err(|e| e.to_string())?;
    Ok(r.get("ok").and_then(|v| v.as_bool()).unwrap_or(false))
}

#[tauri::command]
pub fn sync_inbox(state: State<AppState>) -> Result<SyncSummary, String> {
    let s = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        settings::load_with_password(&conn).map_err(|e| e.to_string())?
    };

    let fetch_payload = json!({
        "host": s.imap_host,
        "port": s.imap_port,
        "login": s.login,
        "password": s.password.unwrap_or_default(),
        "mailbox": s.mailbox,
        "limit": s.fetch_limit,
    });
    let fetched: FetchResult = python::run_script("fetch_emails.py", &fetch_payload)
        .map_err(|e| e.to_string())?;
    if !fetched.ok {
        return Err(fetched.error.unwrap_or_else(|| "fetch failed".into()));
    }

    let mut summary = SyncSummary {
        fetched: fetched.emails.len(),
        new: 0,
        classified: 0,
        errors: vec![],
    };

    // Pull few-shot examples from corrections to bias classifier.
    let examples = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare(
                "SELECT subject, snippet, from_addr, new_category FROM corrections
                 ORDER BY created_at DESC LIMIT 12",
            )
            .map_err(|e| e.to_string())?;
        let rows = st
            .query_map([], |row| {
                Ok(json!({
                    "subject": row.get::<_, String>(0)?,
                    "snippet": row.get::<_, String>(1)?,
                    "from":    row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    "category": row.get::<_, String>(3)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        rows.filter_map(Result::ok).collect::<Vec<_>>()
    };

    for em in fetched.emails {
        // Skip if already stored.
        let exists: bool = {
            let conn = state.db.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT 1 FROM emails WHERE uid=?1",
                params![em.uid],
                |_| Ok(true),
            )
            .unwrap_or(false)
        };
        if exists {
            continue;
        }
        summary.new += 1;

        let classify_payload = json!({
            "ollama_url": s.ollama_url,
            "model": s.model,
            "subject": em.subject,
            "from": em.from_addr,
            "snippet": em.snippet,
            "body": em.body,
            "examples": examples,
        });
        let cls = python::run_script::<ClassificationResult>("classify.py", &classify_payload);

        let (category, confidence) = match cls {
            Ok(r) => {
                summary.classified += 1;
                (r.category, r.confidence)
            }
            Err(e) => {
                summary.errors.push(format!("classify {}: {}", em.uid, e));
                ("noise".into(), 0.0)
            }
        };

        let conn = state.db.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO emails
              (uid, message_id, from_addr, from_name, to_addr, subject, body, snippet, received_at, category, confidence)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                em.uid,
                em.message_id,
                em.from_addr,
                em.from_name,
                em.to_addr,
                em.subject,
                em.body,
                em.snippet,
                em.received_at,
                category,
                confidence,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // Retention cleanup.
    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let _ = db::purge_older_than_days(&conn, s.retention_days as i64);
    }

    Ok(summary)
}

#[tauri::command]
pub fn list_emails(state: State<AppState>, limit: Option<i64>) -> Result<Vec<EmailRow>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(200);
    let mut st = conn
        .prepare(
            "SELECT id, uid, from_addr, from_name, subject, snippet, received_at,
                    category, confidence, is_read, is_draft_generated
             FROM emails ORDER BY received_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map(params![limit], row_to_email)
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
pub fn list_emails_by_category(
    state: State<AppState>,
    category: String,
) -> Result<Vec<EmailRow>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut st = conn
        .prepare(
            "SELECT id, uid, from_addr, from_name, subject, snippet, received_at,
                    category, confidence, is_read, is_draft_generated
             FROM emails WHERE category=?1 ORDER BY received_at DESC LIMIT 500",
        )
        .map_err(|e| e.to_string())?;
    let rows = st
        .query_map(params![category], row_to_email)
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
pub fn category_counts(state: State<AppState>) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut st = conn
        .prepare(
            "SELECT category, COUNT(*) FROM emails WHERE is_read=0 GROUP BY category",
        )
        .map_err(|e| e.to_string())?;
    let mut out = json!({"reply": 0, "important": 0, "event": 0, "noise": 0});
    let mut q = st.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = q.next().map_err(|e| e.to_string())? {
        let cat: String = row.get(0).map_err(|e| e.to_string())?;
        let n: i64 = row.get(1).map_err(|e| e.to_string())?;
        out[cat] = json!(n);
    }
    Ok(out)
}

#[tauri::command]
pub fn get_email(state: State<AppState>, id: i64) -> Result<EmailFull, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let row = conn
        .query_row(
            "SELECT id, uid, from_addr, from_name, subject, snippet, received_at,
                    category, confidence, is_read, is_draft_generated, body
             FROM emails WHERE id=?1",
            params![id],
            |row| {
                let r = EmailRow {
                    id: row.get(0)?,
                    uid: row.get(1)?,
                    from_addr: row.get(2)?,
                    from_name: row.get(3)?,
                    subject: row.get(4)?,
                    snippet: row.get(5)?,
                    received_at: row.get(6)?,
                    category: row.get(7)?,
                    confidence: row.get(8)?,
                    is_read: row.get::<_, i64>(9)? != 0,
                    is_draft_generated: row.get::<_, i64>(10)? != 0,
                };
                let body: String = row.get(11)?;
                Ok((r, body))
            },
        )
        .map_err(|e| e.to_string())?;

    let draft: Option<String> = conn
        .query_row(
            "SELECT body FROM drafts WHERE email_id=?1",
            params![id],
            |r| r.get(0),
        )
        .ok();

    Ok(EmailFull {
        row: row.0,
        body: row.1,
        draft,
    })
}

#[tauri::command]
pub fn recategorize_email(
    state: State<AppState>,
    id: i64,
    new_category: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let (subject, snippet, from_addr, old_cat): (String, String, String, String) = conn
        .query_row(
            "SELECT subject, snippet, from_addr, category FROM emails WHERE id=?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| e.to_string())?;
    if old_cat == new_category {
        return Ok(());
    }
    conn.execute(
        "UPDATE emails SET category=?1, user_corrected=1 WHERE id=?2",
        params![new_category, id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO corrections (subject, snippet, from_addr, old_category, new_category)
         VALUES (?1,?2,?3,?4,?5)",
        params![subject, snippet, from_addr, old_cat, new_category],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn mark_read(state: State<AppState>, id: i64, read: bool) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE emails SET is_read=?1 WHERE id=?2",
        params![read as i64, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn generate_draft(state: State<AppState>, id: i64) -> Result<String, String> {
    let (subject, body, from_addr, s) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let (subject, body, from_addr): (String, String, String) = conn
            .query_row(
                "SELECT subject, body, from_addr FROM emails WHERE id=?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .map_err(|e| e.to_string())?;
        let s = settings::load(&conn).map_err(|e| e.to_string())?;
        (subject, body, from_addr, s)
    };

    let payload = json!({
        "ollama_url": s.ollama_url,
        "model": s.model,
        "subject": subject,
        "from": from_addr,
        "body": body,
    });
    let resp: serde_json::Value = python::run_script("draft.py", &payload)
        .map_err(|e| e.to_string())?;
    let draft = resp
        .get("draft")
        .and_then(|v| v.as_str())
        .ok_or("no draft in response")?
        .to_string();

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO drafts (email_id, body) VALUES (?1, ?2)
         ON CONFLICT(email_id) DO UPDATE SET body=excluded.body, created_at=CURRENT_TIMESTAMP",
        params![id, draft],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE emails SET is_draft_generated=1 WHERE id=?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(draft)
}

#[tauri::command]
pub fn generate_digest(state: State<AppState>) -> Result<String, String> {
    // Pull last 24h grouped by category.
    let since = (Utc::now() - chrono::Duration::hours(24)).to_rfc3339();
    let items = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut st = conn
            .prepare(
                "SELECT subject, from_addr, snippet, category
                 FROM emails WHERE received_at >= ?1
                 ORDER BY category, received_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let r = st
            .query_map(params![since], |r| {
                Ok(json!({
                    "subject":  r.get::<_, String>(0)?,
                    "from":     r.get::<_, String>(1)?,
                    "snippet":  r.get::<_, String>(2)?,
                    "category": r.get::<_, String>(3)?,
                }))
            })
            .map_err(|e| e.to_string())?;
        r.filter_map(Result::ok).collect::<Vec<_>>()
    };

    let s = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        settings::load(&conn).map_err(|e| e.to_string())?
    };

    let payload = json!({
        "ollama_url": s.ollama_url,
        "model": s.model,
        "items": items,
    });
    let resp: serde_json::Value = python::run_script("digest.py", &payload)
        .map_err(|e| e.to_string())?;
    let body = resp
        .get("digest")
        .and_then(|v| v.as_str())
        .ok_or("no digest in response")?
        .to_string();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO digests (day, body) VALUES (?1, ?2)
         ON CONFLICT(day) DO UPDATE SET body=excluded.body, created_at=CURRENT_TIMESTAMP",
        params![today, body],
    )
    .map_err(|e| e.to_string())?;
    Ok(body)
}

fn row_to_email(row: &rusqlite::Row) -> rusqlite::Result<EmailRow> {
    Ok(EmailRow {
        id: row.get(0)?,
        uid: row.get(1)?,
        from_addr: row.get(2)?,
        from_name: row.get(3)?,
        subject: row.get(4)?,
        snippet: row.get(5)?,
        received_at: row.get(6)?,
        category: row.get(7)?,
        confidence: row.get(8)?,
        is_read: row.get::<_, i64>(9)? != 0,
        is_draft_generated: row.get::<_, i64>(10)? != 0,
    })
}
