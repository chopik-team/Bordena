#[tauri::command]
pub fn notify_deadline(window: tauri::WebviewWindow, title: String, body: String) -> Result<(), String> {
    if title.len() > 4096 || body.len() > 4096 { return Err("Notification text is too long".into()); }
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::{Shell::*, WindowsAndMessaging::{LoadIconW, IDI_APPLICATION}};
        let handle = window.hwnd().map_err(|e|e.to_string())?.0 as usize;
        let mut icon = NOTIFYICONDATAW::default();
        icon.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
        icon.hWnd = handle as _;
        icon.uID = 4004;
        icon.uFlags = NIF_INFO | NIF_ICON | NIF_TIP;
        icon.hIcon = unsafe { LoadIconW(std::ptr::null_mut(), IDI_APPLICATION) };
        for (dest, value) in icon.szTip.iter_mut().zip("Bordena".encode_utf16()) { *dest=value; }
        for (dest, value) in icon.szInfoTitle.iter_mut().take(63).zip(title.encode_utf16()) { *dest=value; }
        for (dest, value) in icon.szInfo.iter_mut().take(255).zip(body.encode_utf16()) { *dest=value; }
        icon.dwInfoFlags = NIIF_WARNING;
        if unsafe { Shell_NotifyIconW(NIM_ADD, &icon) } == 0 { return Err("Windows did not accept the notification".into()); }
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(12));
            let mut cleanup=NOTIFYICONDATAW::default();
            cleanup.cbSize=std::mem::size_of::<NOTIFYICONDATAW>() as u32;
            cleanup.hWnd=handle as _;cleanup.uID=4004;
            unsafe { Shell_NotifyIconW(NIM_DELETE, &cleanup); }
        });
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { let _=(window,title,body); Err("Windows notifications are unavailable on this platform".into()) }
}
