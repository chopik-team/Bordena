use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
pub struct LocalFileInfo { name: String, size: u64, mime: String, exists: bool }

fn checked_path(value: &str) -> Result<PathBuf, String> {
    // Local drive paths only: no URL, UNC/SMB, device path, shell fragment or traversal.
    let bytes = value.as_bytes();
    if bytes.len() < 4 || !bytes[0].is_ascii_alphabetic() || bytes[1] != b':' || !matches!(bytes[2], b'\\' | b'/') || value.contains('\0') || value[2..].contains(':') {
        return Err("Only absolute local drive paths are supported".into());
    }
    let path = Path::new(value);
    if path.components().any(|part| matches!(part, std::path::Component::ParentDir)) { return Err("Parent traversal is not allowed".into()); }
    let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
    if !["mp4", "webm", "mov", "mkv", "avi", "m4v", "mp3", "wav", "ogg", "m4a", "flac", "png", "jpg", "jpeg", "webp", "gif", "pdf", "docx", "xlsx", "pptx", "txt", "zip"].contains(&ext.as_str()) { return Err("Unsupported local file type".into()); }
    if path.exists() {
        let canonical = path.canonicalize().map_err(|e| e.to_string())?;
        let text = canonical.to_string_lossy();
        if text.starts_with("\\\\?\\UNC\\") || text.starts_with("\\\\") && !text.starts_with("\\\\?\\") { return Err("Network paths are not supported".into()); }
        if !canonical.is_file() { return Err("The path does not refer to a file".into()); }
    }
    Ok(path.to_path_buf())
}

#[tauri::command]
pub fn local_file_info(app: tauri::AppHandle, path: String) -> Result<LocalFileInfo, String> {
    let file = checked_path(&path)?;
    let exists = file.is_file();
    let ext = file.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match ext.as_str() { "mp4"|"m4v"=>"video/mp4", "webm"=>"video/webm", "mov"=>"video/quicktime", "mp3"=>"audio/mpeg", "wav"=>"audio/wav", _=>"application/octet-stream" };
    if exists { app.asset_protocol_scope().allow_file(&file).map_err(|e| e.to_string())?; }
    Ok(LocalFileInfo { name:file.file_name().unwrap_or_default().to_string_lossy().into_owned(), size:if exists {file.metadata().map_err(|e|e.to_string())?.len()} else {0}, mime:mime.into(), exists })
}

#[tauri::command]
pub fn open_local_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let file = checked_path(&path)?;
    if !file.is_file() { return Err("Local file is unavailable".into()); }
    app.opener().open_path(file.to_string_lossy().into_owned(), None::<String>).map_err(|e|e.to_string())
}

#[cfg(test)]
mod tests {
    use super::checked_path;
    #[test]
    fn rejects_shell_network_device_and_executable_paths() {
        for path in ["https://example.com/a.mp4", "\\\\server\\share\\a.mp4", "\\\\?\\C:\\a.mp4", "C:\\a.exe", "C:\\x.bat", "C:\\x.lnk", "C:\\folder\\..\\a.mp4", "C:\\a.mp4:stream"] { assert!(checked_path(path).is_err(), "{path}"); }
        assert!(checked_path("C:\\Bordena\\.tools\\qa-video-not-present.mp4").is_ok());
    }
}
