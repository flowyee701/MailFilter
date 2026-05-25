//! Minimal Ollama client used by the onboarding wizard.
//!
//! For full `/api/generate` calls during sync, we still go through the python
//! sidecar (so the prompt/parsing logic lives in one place). This module only
//! needs to:
//!   - check if `ollama serve` is reachable
//!   - list locally-installed models
//!   - pull a model with streaming progress events to the frontend

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostics {
    /// True if `GET /api/tags` succeeded — Ollama daemon is up.
    pub running: bool,
    /// True if `/Applications/Ollama.app` exists.
    pub app_installed: bool,
    /// True if the `ollama` CLI is on $PATH (typically via Homebrew).
    pub cli_installed: bool,
    /// Locally-pulled model names. Empty when running=false.
    pub models: Vec<String>,
}

pub fn diagnose(base_url: &str) -> Diagnostics {
    let models = list_models(base_url).unwrap_or_default();
    Diagnostics {
        running: !models.is_empty() || ping(base_url),
        app_installed: Path::new("/Applications/Ollama.app").exists(),
        cli_installed: which_ollama().is_some(),
        models,
    }
}

fn ping(base_url: &str) -> bool {
    client(Duration::from_secs(2))
        .get(format!("{}/api/tags", base_url.trim_end_matches('/')))
        .send()
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

pub fn list_models(base_url: &str) -> Result<Vec<String>> {
    let resp = client(Duration::from_secs(3))
        .get(format!("{}/api/tags", base_url.trim_end_matches('/')))
        .send()
        .context("ollama unreachable")?;
    if !resp.status().is_success() {
        return Err(anyhow!("/api/tags returned {}", resp.status()));
    }
    let v: Value = resp.json().context("parse /api/tags")?;
    let names = v
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(names)
}

/// Start Ollama if we can. Best-effort:
///   1. macOS Ollama.app: `open -a Ollama`
///   2. Homebrew service: `brew services start ollama`
///   3. Foreground daemon as a fallback: `ollama serve &` (detached)
/// Returns true if any of those launched something without an immediate error.
pub fn try_start() -> bool {
    if Path::new("/Applications/Ollama.app").exists() {
        let ok = Command::new("open")
            .args(["-a", "Ollama"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            return true;
        }
    }
    if which_brew().is_some() {
        let ok = Command::new("brew")
            .args(["services", "start", "ollama"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            return true;
        }
    }
    if let Some(ollama) = which_ollama() {
        // Detach so we don't wait on it.
        let r = Command::new(ollama)
            .arg("serve")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null())
            .spawn();
        return r.is_ok();
    }
    false
}

fn which_ollama() -> Option<String> {
    for c in ["/opt/homebrew/bin/ollama", "/usr/local/bin/ollama", "ollama"] {
        if Command::new(c)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Some(c.to_string());
        }
    }
    None
}

fn which_brew() -> Option<String> {
    for c in ["/opt/homebrew/bin/brew", "/usr/local/bin/brew", "brew"] {
        if Command::new(c)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return Some(c.to_string());
        }
    }
    None
}

fn client(timeout: Duration) -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(timeout)
        .build()
        .expect("reqwest client")
}

#[derive(Debug, Serialize, Clone)]
pub struct PullProgress {
    pub model: String,
    pub status: String,
    pub completed: u64,
    pub total: u64,
    pub percent: f64,
    pub done: bool,
    pub error: Option<String>,
}

/// Pull `model` from the Ollama registry, streaming progress events to the
/// frontend as `model-pull-progress` Tauri events.
///
/// Spawned on a background thread because the HTTP body is multi-minute and we
/// don't want to block the Tauri command worker.
pub fn pull_model(handle: AppHandle, base_url: &str, model: &str) {
    let url = format!("{}/api/pull", base_url.trim_end_matches('/'));
    let model = model.to_string();
    let base_url = base_url.to_string();

    std::thread::spawn(move || {
        let emit = |p: &PullProgress| {
            let _ = handle.emit_all("model-pull-progress", p);
        };

        // Quick reachability check up front so we can fail loud.
        if !ping(&base_url) {
            emit(&PullProgress {
                model: model.clone(),
                status: "Ollama is not running".into(),
                completed: 0,
                total: 0,
                percent: 0.0,
                done: true,
                error: Some("Cannot reach Ollama at the configured URL".into()),
            });
            return;
        }

        let req = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(60 * 60)) // pulls can take a while
            .build()
            .expect("reqwest client");
        let resp = match req
            .post(&url)
            .json(&json!({ "name": model, "stream": true }))
            .send()
        {
            Ok(r) => r,
            Err(e) => {
                emit(&PullProgress {
                    model: model.clone(),
                    status: "request failed".into(),
                    completed: 0,
                    total: 0,
                    percent: 0.0,
                    done: true,
                    error: Some(e.to_string()),
                });
                return;
            }
        };
        if !resp.status().is_success() {
            emit(&PullProgress {
                model: model.clone(),
                status: format!("HTTP {}", resp.status()),
                completed: 0,
                total: 0,
                percent: 0.0,
                done: true,
                error: Some(format!("Ollama returned {}", resp.status())),
            });
            return;
        }

        let reader = BufReader::new(resp);
        let mut last_total: u64 = 0;
        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            if line.trim().is_empty() {
                continue;
            }
            let v: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let status = v
                .get("status")
                .and_then(|s| s.as_str())
                .unwrap_or("")
                .to_string();
            let completed = v.get("completed").and_then(|x| x.as_u64()).unwrap_or(0);
            let total = v.get("total").and_then(|x| x.as_u64()).unwrap_or(last_total);
            last_total = total.max(last_total);
            let percent = if total > 0 {
                (completed as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            let err = v
                .get("error")
                .and_then(|s| s.as_str())
                .map(String::from);
            emit(&PullProgress {
                model: model.clone(),
                status,
                completed,
                total,
                percent,
                done: false,
                error: err,
            });
        }

        emit(&PullProgress {
            model: model.clone(),
            status: "complete".into(),
            completed: last_total,
            total: last_total,
            percent: 100.0,
            done: true,
            error: None,
        });
    });
}
