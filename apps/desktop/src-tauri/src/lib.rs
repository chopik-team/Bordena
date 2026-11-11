mod hide_window;
mod quick_note;
mod shortcuts;
mod tear_off;
mod vault;
mod local_media;
mod notifications;

use tauri::{Manager, WindowEvent, WebviewWindowBuilder};
#[cfg(target_os = "macos")]
use tauri::RunEvent;

pub(crate) fn qa_profile_root() -> Option<std::path::PathBuf> {
    // Release smoke QA is opt-in twice and never falls back to the real profile.
    let qa = std::env::args().any(|arg| arg == "--bordena-qa");
    if cfg!(debug_assertions) || qa {
        if let Some(path) = std::env::var_os("BORDENA_TEST_PROFILE") {
            let path = std::path::PathBuf::from(path);
            assert!(valid_qa_profile(&path), "QA profile must be an absolute .tools/qa-* directory");
            return Some(path);
        }
        assert!(!qa, "--bordena-qa requires BORDENA_TEST_PROFILE");
    }
    None
}

fn profile_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    qa_profile_root().unwrap_or_else(|| app.path().app_local_data_dir().expect("Bordena data path")).join("WebView2")
}

fn valid_qa_profile(path: &std::path::Path) -> bool {
    path.is_absolute()
        && !path.components().any(|p| matches!(p, std::path::Component::ParentDir))
        && path.file_name().and_then(|s| s.to_str()).is_some_and(|s| s.starts_with("qa-") && s.len() > 3)
        && path.parent().and_then(|p| p.file_name()).is_some_and(|s| s == ".tools")
}

#[tauri::command]
fn storage_profile(app: tauri::AppHandle) -> String {
    profile_dir(&app).to_string_lossy().into_owned()
}

fn valid_card_window_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

// Absolute WebView2 profiles must be configured in Rust: the JS builder accepts
// only paths inside its per-window data directory. Every app window shares the
// one explicitly selected Bordena profile, including isolated QA profiles.
#[tauri::command]
async fn open_card_window(app: tauri::AppHandle, card_id: String, x: Option<f64>, y: Option<f64>) -> Result<(), String> {
    if !valid_card_window_id(&card_id) { return Err("Invalid card ID".into()); }
    let label = format!("popout-{card_id}");
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }
    let mut builder = WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(format!("w/{card_id}").into()))
        .title("Bordena").inner_size(800.0, 640.0).min_inner_size(400.0, 320.0)
        .disable_drag_drop_handler().data_directory(profile_dir(&app));
    if let Some(main) = app.get_webview_window("main") { builder = builder.theme(main.theme().ok()); }
    if let (Some(x), Some(y)) = (x,y) { if x.is_finite() && y.is_finite() { builder = builder.position(x,y); } }
    builder.build().map_err(|e|e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod card_window_tests {
    #[test]
    fn isolates_release_qa_profiles() {
        use std::path::Path;
        assert!(super::valid_qa_profile(Path::new("C:/Bordena/.tools/qa-release")));
        for p in ["C:/Users/PC/AppData/real", "C:/Bordena/.tools/qa-", "C:/Bordena/.tools/../.tools/qa-x", "relative/.tools/qa-test"] {
            assert!(!super::valid_qa_profile(Path::new(p)));
        }
    }
    #[test]
    fn accepts_only_local_entity_ids() {
        for id in ["card-12", "qa_card_1"] { assert!(super::valid_card_window_id(id)); }
        for id in ["", "../outside", "card/id", "file:///x", "a?query"] { assert!(!super::valid_card_window_id(id)); }
        assert!(!super::valid_card_window_id(&"a".repeat(129)));
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Validate opt-in before any plugin can read global configuration.
    let isolated_qa = qa_profile_root().is_some();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            vault::ignore_vault,
            quick_note::hide_quick_note,
            tear_off::start_tear_off,
            tear_off::end_tear_off,
            shortcuts::get_shortcut,
            shortcuts::suspend_shortcut,
            shortcuts::set_shortcut,
            shortcuts::clear_shortcut,
            storage_profile,
            open_card_window,
            local_media::local_file_info,
            local_media::open_local_file,
            notifications::notify_deadline,
            quit_app
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // These plugins persist to the normal OS app-config folder. QA must
            // neither inherit nor overwrite the user's window state or grants.
            if !isolated_qa {
                app.handle().plugin(tauri_plugin_window_state::Builder::default()
                    .with_filter(|label| label == "main").build())?;
                app.handle().plugin(tauri_plugin_persisted_scope::init())?;
            }
            let data_dir = profile_dir(app.handle());
            std::fs::create_dir_all(&data_dir)?;
            // Fail visibly before opening a window when the profile is not writable.
            let probe = data_dir.join(".write-probe");
            std::fs::write(&probe, b"bordena")?;
            std::fs::remove_file(&probe)?;
            for config in &app.config().app.windows {
                WebviewWindowBuilder::from_config(app, config)?
                    .data_directory(data_dir.clone())
                    .build()?;
            }
            quick_note::init(app.handle());
            shortcuts::init(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            quick_note::on_window_event(window, event);
            // Closing the main window only hides it, so the shortcut keeps
            // working; Cmd+Q still quits. Popouts hide too: destroying a
            // webview races WebKit's display link on macOS and segfaults.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label.starts_with("popout-") {
                    api.prevent_close();
                    hide_window::hide(window);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            }
            let _ = (app, &event);
        });
}
