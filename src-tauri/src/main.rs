#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use regex::Regex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, Runtime};

#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::{ILCreateFromPathW, ILFree, SHOpenFolderAndSelectItems};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::RPC_E_CHANGED_MODE;

struct RecentState(Mutex<Vec<String>>);

#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn build_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    recents: &[String],
) -> tauri::Result<tauri::menu::Menu<R>> {
    let mut file_builder = SubmenuBuilder::new(app, "File")
        .text("file_new", "New")
        .text("file_open", "Open")
        .text("file_open_folder", "Open Folder")
        .text("file_preferences", "Preferences")
        .text("file_save", "Save")
        .text("file_save_as", "Save As");

    let recent_menu = if recents.is_empty() {
        let empty = MenuItemBuilder::new("No recent files")
            .enabled(false)
            .build(app)?;
        SubmenuBuilder::new(app, "Open Recent")
            .item(&empty)
            .build()?
    } else {
        let mut recent_builder = SubmenuBuilder::new(app, "Open Recent");
        for (idx, path) in recents.iter().enumerate() {
            let label = Path::new(path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(path);
            let id = format!("recent:{}", idx);
            recent_builder = recent_builder.text(id, label);
        }
        recent_builder.build()?
    };

    file_builder = file_builder.item(&recent_menu);
    let file_menu = file_builder.build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .text("view_toggle_preview", "Toggle Source")
        .text("view_toggle_theme", "Toggle Theme")
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&view_menu)
        .build()
}

#[tauri::command]
fn set_recent_menu(app: tauri::AppHandle, recents: Vec<String>) -> Result<(), String> {
    if let Ok(mut state) = app.state::<RecentState>().0.lock() {
        *state = recents.clone();
    }
    let menu = build_menu(&app, &recents).map_err(|e| e.to_string())?;
    let _ = app.set_menu(menu);
    Ok(())
}

#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("Path does not exist".into());
    }

    #[cfg(target_os = "windows")]
    {
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let did_init = if hr.is_err() {
                if hr == RPC_E_CHANGED_MODE {
                    false
                } else {
                    return Err(format!("COM init failed: {hr:?}"));
                }
            } else {
                true
            };
            let pidl = ILCreateFromPathW(windows::core::PCWSTR(wide.as_ptr()));
            if pidl.is_null() {
                if did_init {
                    CoUninitialize();
                }
                return Err("Failed to create PIDL".into());
            }
            let result = SHOpenFolderAndSelectItems(pidl, None, 0);
            ILFree(Some(pidl));
            if did_init {
                CoUninitialize();
            }
            result.map_err(|e| format!("Open folder failed: {e:?}"))?;
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = std::process::Command::new("open");
        if target.is_dir() {
            cmd.arg(target);
        } else {
            cmd.arg("-R").arg(target);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let mut cmd = std::process::Command::new("xdg-open");
        if target.is_dir() {
            cmd.arg(target);
        } else if let Some(parent) = target.parent() {
            cmd.arg(parent);
        } else {
            cmd.arg(target);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
}

fn extract_first_url(output: &str) -> Option<String> {
    let re = Regex::new(r#"https?://[^\s"'<>]+"#).ok()?;
    re.find(output).map(|m| m.as_str().to_string())
}

fn extract_url_from_json_text(output: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(output).ok()?;
    if let Some(url) = value
        .get("result")
        .and_then(|r| r.as_array())
        .and_then(|arr| arr.iter().find_map(|v| v.as_str()))
    {
        return Some(url.to_string());
    }
    if let Some(url) = value.get("url").and_then(|v| v.as_str()) {
        return Some(url.to_string());
    }
    None
}

#[derive(serde::Serialize)]
struct PicgoUploadResult {
    success: bool,
    url: Option<String>,
    stdout: String,
    stderr: String,
}

fn run_picgo_upload(picgo: &Path, image: &Path) -> Result<PicgoUploadResult, String> {
    let output = std::process::Command::new(picgo)
        .arg("upload")
        .arg(image)
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let merged = format!("{stdout}\n{stderr}");

    let url = extract_first_url(&merged)
        .or_else(|| extract_url_from_json_text(stdout.trim()))
        .or_else(|| extract_url_from_json_text(stderr.trim()));

    Ok(PicgoUploadResult {
        success: output.status.success(),
        url,
        stdout,
        stderr,
    })
}

#[tauri::command]
fn picgo_validate(picgo_path: String) -> Result<String, String> {
    let path = Path::new(&picgo_path);
    if !path.exists() {
        return Err("PicGo path not found".into());
    }
    let output = std::process::Command::new(path)
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        return Ok(if stdout.is_empty() { "PicGo detected".into() } else { stdout });
    }
    Err(if !stderr.is_empty() { stderr } else { "PicGo validate failed".into() })
}

#[tauri::command]
fn picgo_upload(picgo_path: String, image_path: String) -> Result<String, String> {
    let picgo = Path::new(&picgo_path);
    if !picgo.exists() {
        return Err("PicGo path not found".into());
    }
    let image = Path::new(&image_path);
    if !image.exists() {
        return Err("Image path not found".into());
    }
    let result = run_picgo_upload(picgo, image)?;
    if !result.success {
        let merged = format!("{}\n{}", result.stdout, result.stderr);
        return Err(format!("PicGo upload failed: {}", merged.trim()));
    }
    Ok(serde_json::to_string(&result).unwrap_or_else(|_| "{\"success\":true}".to_string()))
}

#[tauri::command]
fn picgo_validate_upload(picgo_path: String) -> Result<String, String> {
    let picgo = Path::new(&picgo_path);
    if !picgo.exists() {
        return Err("PicGo path not found".into());
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = std::env::temp_dir().join(format!("ease-md-picgo-test-{stamp}.png"));
    // 1x1 transparent PNG
    let png_bytes: [u8; 67] = [
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0,
        1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 11, 73, 68, 65, 84, 120, 156, 99, 0, 1,
        0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];
    std::fs::write(&temp_path, png_bytes).map_err(|e| e.to_string())?;
    let result = run_picgo_upload(picgo, &temp_path)?;
    let _ = std::fs::remove_file(&temp_path);
    Ok(serde_json::to_string(&result).unwrap_or_else(|_| "{\"success\":false}".to_string()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(RecentState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            app_version,
            set_recent_menu,
            reveal_in_folder,
            picgo_validate,
            picgo_upload,
            picgo_validate_upload
        ])
        .setup(|app| {
            let dist_index = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("dist")
                .join("index.html");
            println!(
                "dist/index.html exists: {} ({})",
                dist_index.exists(),
                dist_index.display()
            );

            let menu = build_menu(&app.handle(), &[]);
            if let Ok(menu) = menu {
                let _ = app.set_menu(menu);
            }

            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let id = event.id().0.clone();
                if id.starts_with("recent:") {
                    if let Ok(state) = app_handle.state::<RecentState>().0.lock() {
                        if let Ok(index) = id["recent:".len()..].parse::<usize>() {
                            if let Some(path) = state.get(index) {
                                let _ = app_handle.emit_to("main", "menu:open-recent", path.clone());
                                return;
                            }
                        }
                    }
                }
                let _ = app_handle.emit_to("main", "menu:action", id);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
