//! Global shortcuts, each named so the settings UI can bind it. Saved as a
//! name -> shortcut map in `shortcuts.json`; there are no defaults, an unset
//! name registers nothing.

use std::{collections::BTreeMap, fs, path::PathBuf};
use tauri::{AppHandle, Manager};

use crate::quick_note;

struct Action {
    name: &'static str,
    run: fn(&AppHandle),
}

const ACTIONS: &[Action] = &[Action {
    name: "quick-note",
    run: quick_note::toggle,
}];

const FILE: &str = "shortcuts.json";

type Saved = BTreeMap<String, String>;

fn action(name: &str) -> Result<&'static Action, String> {
    ACTIONS
        .iter()
        .find(|a| a.name == name)
        .ok_or_else(|| format!("unknown shortcut: {name}"))
}

fn path(app: &AppHandle) -> Option<PathBuf> {
    if let Some(root) = crate::qa_profile_root() {
        return Some(root.join(FILE));
    }
    app.path().app_config_dir().ok().map(|dir| dir.join(FILE))
}

fn load(app: &AppHandle) -> Saved {
    path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(app: &AppHandle, saved: &Saved) -> Result<(), String> {
    let Some(path) = path(app) else {
        return Ok(());
    };
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(saved).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn current(app: &AppHandle, action: &Action) -> Option<String> {
    load(app).remove(action.name)
}

#[cfg(desktop)]
fn register(app: &AppHandle, action: &'static Action, shortcut: &str) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _, event| {
            if event.state() == ShortcutState::Pressed {
                (action.run)(app);
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(desktop)]
fn unregister(app: &AppHandle, shortcut: &str) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let _ = app.global_shortcut().unregister(shortcut);
}

#[cfg(not(desktop))]
fn register(_: &AppHandle, _: &'static Action, _: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(desktop))]
fn unregister(_: &AppHandle, _: &str) {}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(desktop)]
    app.plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
    for action in ACTIONS {
        let Some(shortcut) = current(app, action) else {
            continue;
        };
        // The desktop environment may own the shortcut.
        if let Err(e) = register(app, action, &shortcut) {
            eprintln!("shortcut {} ({shortcut}) not registered: {e}", action.name);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_shortcut(app: AppHandle, name: String) -> Result<Option<String>, String> {
    Ok(current(&app, action(&name)?))
}

/// Lets the settings recorder hear the current shortcut; `set` brings one back.
#[tauri::command]
pub fn suspend_shortcut(app: AppHandle, name: String) -> Result<(), String> {
    if let Some(shortcut) = current(&app, action(&name)?) {
        unregister(&app, &shortcut);
    }
    Ok(())
}

/// Swaps one shortcut; on a bad one the old stays and the error is returned.
#[tauri::command]
pub fn set_shortcut(app: AppHandle, name: String, shortcut: String) -> Result<(), String> {
    let action = action(&name)?;
    let old = current(&app, action);
    if let Some(old) = &old {
        unregister(&app, old);
    }
    if let Err(e) = register(&app, action, &shortcut) {
        if let Some(old) = &old {
            let _ = register(&app, action, old);
        }
        return Err(e);
    }
    let mut saved = load(&app);
    saved.insert(name, shortcut);
    save(&app, &saved)
}

#[tauri::command]
pub fn clear_shortcut(app: AppHandle, name: String) -> Result<(), String> {
    if let Some(old) = current(&app, action(&name)?) {
        unregister(&app, &old);
    }
    let mut saved = load(&app);
    saved.remove(&name);
    save(&app, &saved)
}
