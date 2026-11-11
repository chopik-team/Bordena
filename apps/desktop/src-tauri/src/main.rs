// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The bundled WebKitGTK in the AppImage renders a blank window on NVIDIA and
    // some Wayland setups when its DMA-BUF renderer fails to init. Scoped to the
    // AppImage.
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_some()
        && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    bordena_desktop_lib::run()
}
