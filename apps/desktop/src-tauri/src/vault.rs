const GITIGNORE: &str = "\
# A board mirrored by Deck.
#
# Using git here is not recommended if you share this board with anyone.
# Jumping between branches and commits rewrites these files, and the board
# syncs straight away, so you would spoil its state for everyone else.
#
# If the board is yours alone, it is fine, and you can remove .gitignore.
*
";

/// Writes a `.gitignore` into a mounted vault folder,
/// fs plugin can not write dot files
#[tauri::command]
pub fn ignore_vault(dir: String) -> Result<(), String> {
    let path = std::path::Path::new(&dir).join(".gitignore");
    if path.exists() {
        return Ok(());
    }
    std::fs::write(path, GITIGNORE).map_err(|e| e.to_string())
}
