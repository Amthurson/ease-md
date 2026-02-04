#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, Runtime};

struct RecentState(Mutex<Vec<String>>);

fn build_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    recents: &[String],
) -> tauri::Result<tauri::menu::Menu<R>> {
    let mut file_builder = SubmenuBuilder::new(app, "File")
        .text("file_new", "New")
        .text("file_open", "Open")
        .text("file_open_folder", "Open Folder")
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(RecentState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![set_recent_menu])
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
