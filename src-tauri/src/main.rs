#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod ollama;
mod python;
mod settings;
mod scheduler;

use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

fn main() {
    let conn = db::init().expect("failed to initialize sqlite");

    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(conn) })
        .setup(|app| {
            scheduler::spawn_daily_digest(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_settings,
            commands::load_settings,
            commands::test_connection,
            commands::sync_inbox,
            commands::list_emails,
            commands::list_emails_by_category,
            commands::get_email,
            commands::recategorize_email,
            commands::mark_read,
            commands::generate_draft,
            commands::generate_digest,
            commands::category_counts,
            commands::setup_status,
            commands::ollama_try_start,
            commands::ollama_pull_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
