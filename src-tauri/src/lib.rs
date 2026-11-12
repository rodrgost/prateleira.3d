use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(serde::Serialize)]
struct ImportedFileInfo {
    name: String,
    original_path: String,
    final_path: String,
    moved: bool,
    bytes: Vec<u8>,
}

fn get_app_models_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;

    let models_dir = base_dir.join("Prateleira 3D").join("Modelos");
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }
    Ok(models_dir)
}

#[tauri::command]
async fn get_system_models_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = get_app_models_directory(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_system_models_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = get_app_models_directory(&app)?;
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn process_import_file(
    app: tauri::AppHandle,
    source_path: String,
    move_to_system_folder: bool,
) -> Result<ImportedFileInfo, String> {
    let src = Path::new(&source_path);
    if !src.exists() {
        return Err(format!("Arquivo não encontrado: {}", source_path));
    }

    let file_name = src
        .file_name()
        .ok_or_else(|| "Nome de arquivo inválido".to_string())?
        .to_string_lossy()
        .to_string();

    let bytes = fs::read(src).map_err(|e| format!("Erro ao ler arquivo: {}", e))?;

    let mut final_path = source_path.clone();
    let mut moved = false;

    if move_to_system_folder {
        let dest_dir = get_app_models_directory(&app)?;
        let mut dest_path = dest_dir.join(&file_name);

        // Avoid overwriting existing files by appending a counter if needed
        if dest_path.exists() && dest_path != src {
            let stem = Path::new(&file_name)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "modelo".to_string());
            let ext = Path::new(&file_name)
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy()))
                .unwrap_or_default();

            let mut count = 1;
            while dest_path.exists() {
                dest_path = dest_dir.join(format!("{} ({}){}", stem, count, ext));
                count += 1;
            }
        }

        if src != dest_path {
            // Attempt rename (move), fallback to copy + delete if crossing drives/volumes
            if fs::rename(src, &dest_path).is_err() {
                fs::copy(src, &dest_path).map_err(|e| format!("Erro ao copiar arquivo: {}", e))?;
                let _ = fs::remove_file(src);
            }
            final_path = dest_path.to_string_lossy().to_string();
            moved = true;
        }
    }

    Ok(ImportedFileInfo {
        name: file_name,
        original_path: source_path,
        final_path,
        moved,
        bytes,
    })
}

#[tauri::command]
async fn save_bytes_to_system_folder(
    app: tauri::AppHandle,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let dest_dir = get_app_models_directory(&app)?;
    let mut dest_path = dest_dir.join(&file_name);

    if dest_path.exists() {
        let stem = Path::new(&file_name)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "modelo".to_string());
        let ext = Path::new(&file_name)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();

        let mut count = 1;
        while dest_path.exists() {
            dest_path = dest_dir.join(format!("{} ({}){}", stem, count, ext));
            count += 1;
        }
    }

    fs::write(&dest_path, bytes).map_err(|e| format!("Erro ao salvar no sistema: {}", e))?;
    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_desktop_pet(app: tauri::AppHandle, model_id: String) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("desktop-pet") {
        let _ = existing.close();
    }

    let url_str = format!("index.html?mode=pet&modelId={}", model_id);
    let url = tauri::WebviewUrl::App(url_str.into());

    tauri::WebviewWindowBuilder::new(&app, "desktop-pet", url)
        .title("Desktop Pet 3D")
        .inner_size(340.0, 340.0)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .shadow(false)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_desktop_pet,
            focus_main_window,
            get_system_models_dir,
            open_system_models_dir,
            process_import_file,
            save_bytes_to_system_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
