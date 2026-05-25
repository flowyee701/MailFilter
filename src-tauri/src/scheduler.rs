use crate::{settings, AppState};
use chrono::{Local, Timelike};
use tauri::{api::notification::Notification, AppHandle, Manager};

/// Spawn a background task that sleeps until the next configured digest hour, fires a
/// notification, generates a digest, and repeats every 24h. Kept intentionally simple —
/// good enough for a desktop app that's typically left running during work hours.
pub fn spawn_daily_digest(handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            // Resolve the configured digest hour. Done as a pure-sync helper so the
            // (non-Send) std::sync::MutexGuard never crosses an .await point.
            let hour = read_digest_hour(&handle).unwrap_or(8);

            let secs = seconds_until_hour(hour);
            tokio::time::sleep(std::time::Duration::from_secs(secs)).await;

            // Generate digest. The body of generate_digest is fully synchronous, so any
            // mutex guards it holds live only on its own stack frame — not in our future.
            let body = run_digest(&handle);

            let preview: String = body.chars().take(180).collect();
            let _ = Notification::new(&handle.config().tauri.bundle.identifier)
                .title("MailMind morning digest")
                .body(preview)
                .show();
        }
    });
}

fn read_digest_hour(handle: &AppHandle) -> Option<u32> {
    let state = handle.state::<AppState>();
    let conn = state.db.lock().ok()?;
    settings::load(&conn).ok().map(|s| s.digest_hour)
}

fn run_digest(handle: &AppHandle) -> String {
    let state = handle.state::<AppState>();
    crate::commands::generate_digest(state)
        .unwrap_or_else(|e| format!("Could not generate digest: {e}"))
}

fn seconds_until_hour(target_hour: u32) -> u64 {
    let now = Local::now();
    let mut target = now
        .date_naive()
        .and_hms_opt(target_hour.min(23), 0, 0)
        .unwrap();
    if (now.hour() > target_hour)
        || (now.hour() == target_hour && (now.minute() > 0 || now.second() > 0))
    {
        target += chrono::Duration::days(1);
    }
    let diff = target
        .signed_duration_since(now.naive_local())
        .num_seconds()
        .max(60);
    diff as u64
}
