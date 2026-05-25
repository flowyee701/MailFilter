use anyhow::{anyhow, Context, Result};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;

/// Resolve the directory containing our python scripts.
///
/// Priority:
///   1. `$MAILMIND_PYTHON_DIR` if set
///   2. `<cwd>/../python` (dev: `npm run tauri:dev` runs cargo from `src-tauri/`)
///   3. `<exe-parent>/python` (legacy: scripts sitting next to the binary)
///   4. `<exe-parent>/../Resources/_up_/python` (bundled .app on macOS — Tauri
///      lays out resources under `Contents/Resources/_up_/<resource path>`)
///   5. Writable user dir `~/Library/Application Support/MailMind/python` — used
///      when the bundled scripts aren't on disk (e.g. development outside the
///      project tree) and the user has not provided their own.
pub fn python_dir() -> PathBuf {
    if let Ok(env) = std::env::var("MAILMIND_PYTHON_DIR") {
        return PathBuf::from(env);
    }

    let dev = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("../python");
    if dev.exists() {
        return dev;
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            // Legacy: scripts next to binary.
            let c = parent.join("python");
            if c.exists() {
                return c;
            }
            // Bundled macOS .app: Contents/MacOS/MailMind → Contents/Resources/_up_/python
            let c2 = parent.join("../Resources/_up_/python");
            if c2.exists() {
                return c2;
            }
        }
    }

    // Writable fallback — see ensure_user_scripts().
    user_data_dir().join("python")
}

fn user_data_dir() -> PathBuf {
    let mut p = dirs::data_local_dir().unwrap_or_else(std::env::temp_dir);
    p.push("MailMind");
    p
}

/// Resolve the python interpreter to use.
///
/// Priority:
///   1. `$MAILMIND_PYTHON` if set
///   2. App-private venv at `~/Library/Application Support/MailMind/python/.venv`
///      — created on first call to `bootstrap()`.
///   3. `python3` from PATH (final fallback; assumes the user has `requests` installed)
fn python_bin() -> String {
    if let Ok(env) = std::env::var("MAILMIND_PYTHON") {
        return env;
    }
    let venv_py = venv_python();
    if venv_py.exists() {
        return venv_py.to_string_lossy().into_owned();
    }
    // Repo dev venv (only used when running from a checkout).
    let repo_venv = python_dir().join(".venv/bin/python");
    if repo_venv.exists() {
        return repo_venv.to_string_lossy().into_owned();
    }
    "python3".into()
}

fn venv_dir() -> PathBuf {
    user_data_dir().join("python/.venv")
}

fn venv_python() -> PathBuf {
    venv_dir().join("bin/python")
}

fn find_system_python() -> Option<String> {
    if let Ok(p) = std::env::var("MAILMIND_PYTHON") {
        return Some(p);
    }
    // Try a handful of common locations before giving up.
    let candidates = [
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
        "python3",
    ];
    for c in candidates {
        let ok = Command::new(c)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            return Some(c.to_string());
        }
    }
    None
}

/// One-shot, idempotent: create the app-private venv and pip-install the script
/// requirements. Runs at most once per process. Safe to call from every command.
///
/// On a bundled .app, this turns the first launch into a 20-second "Installing
/// Python dependencies…" beat instead of a confusing "ModuleNotFoundError"
/// later. On dev (where `python/.venv` already exists in the checkout), it's a
/// no-op because `venv_python()` is found before bootstrap is called.
pub fn bootstrap() -> Result<()> {
    static DONE: OnceLock<()> = OnceLock::new();
    if DONE.get().is_some() {
        return Ok(());
    }

    // Fast path: an existing python (dev venv, app-private venv, or user-supplied
    // $MAILMIND_PYTHON) already has `requests`. Nothing to do.
    let current = python_bin();
    if Path::new(&current).exists() && python_has_requests(&current) {
        ensure_user_scripts()?;
        let _ = DONE.set(());
        return Ok(());
    }

    // Slow path: provision an app-private venv under the user-data dir.
    ensure_user_scripts()?;

    let venv = venv_dir();
    let py = venv_python();
    if !py.exists() {
        let sys_py = find_system_python().ok_or_else(|| {
            anyhow!("python3 not found on PATH. Install with `brew install python`")
        })?;
        std::fs::create_dir_all(venv.parent().unwrap()).ok();
        let status = Command::new(&sys_py)
            .args(["-m", "venv", venv.to_str().unwrap()])
            .status()
            .context("failed to spawn python -m venv")?;
        if !status.success() {
            return Err(anyhow!("python -m venv failed"));
        }
    }

    if !python_has_requests(py.to_str().unwrap()) {
        let req = python_dir().join("requirements.txt");
        let mut cmd = Command::new(&py);
        cmd.args(["-m", "pip", "install", "--disable-pip-version-check", "--quiet"]);
        if req.exists() {
            cmd.arg("-r").arg(&req);
        } else {
            cmd.arg("requests>=2.31.0");
        }
        let status = cmd.status().context("pip install failed to spawn")?;
        if !status.success() {
            return Err(anyhow!("pip install failed (exit {:?})", status.code()));
        }
    }

    let _ = DONE.set(());
    Ok(())
}

fn python_has_requests(py: &str) -> bool {
    Command::new(py)
        .args(["-c", "import requests"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// If `python_dir()` resolves to the user-data fallback but no scripts are
/// present there, attempt to copy the bundled scripts in. This is a belt-and-
/// suspenders measure — on a properly bundled .app the resources lookup in
/// `python_dir()` returns a populated path and this is a no-op.
fn ensure_user_scripts() -> Result<()> {
    let target = user_data_dir().join("python");
    let marker = target.join("fetch_emails.py");
    if marker.exists() {
        return Ok(());
    }
    // Try to find scripts shipped alongside the binary.
    let candidates: Vec<PathBuf> = if let Ok(exe) = std::env::current_exe() {
        let parent = exe.parent().map(Path::to_path_buf).unwrap_or_default();
        vec![
            parent.join("python"),
            parent.join("../Resources/_up_/python"),
            parent.join("../Resources/python"),
        ]
    } else {
        vec![]
    };
    for src in candidates {
        if src.join("fetch_emails.py").exists() {
            copy_dir_recursive(&src, &target)?;
            return Ok(());
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        // Skip pycache and any pre-existing venv inside the bundle.
        let n = name.to_string_lossy();
        if n == "__pycache__" || n == ".venv" {
            continue;
        }
        let from = entry.path();
        let to = dst.join(&name);
        let ft = entry.file_type()?;
        if ft.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// Run a python script with a JSON payload on stdin, parse a single JSON object from stdout.
pub fn run_script<T: DeserializeOwned>(script: &str, payload: &Value) -> Result<T> {
    // Lazy bootstrap on the first call. Cheap after the first successful run.
    bootstrap().context("python bootstrap failed")?;

    let script_path = python_dir().join(script);
    if !script_path.exists() {
        return Err(anyhow!("python script not found: {}", script_path.display()));
    }

    let mut child = Command::new(python_bin())
        .arg(script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| "failed to spawn python")?;

    if let Some(mut sin) = child.stdin.take() {
        sin.write_all(payload.to_string().as_bytes())
            .context("failed to write stdin to python")?;
    }

    let out = child.wait_with_output().context("python wait failed")?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow!("python script `{}` failed: {}", script, err));
    }
    let parsed: T = serde_json::from_slice(&out.stdout)
        .with_context(|| {
            format!(
                "failed to parse JSON from `{}`: {}",
                script,
                String::from_utf8_lossy(&out.stdout)
            )
        })?;
    Ok(parsed)
}
