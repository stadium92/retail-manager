use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatchManifest {
    pub version: String,
    pub checksums: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatchProgress {
    pub status: String,
    pub percentage: u32,
    pub message: String,
}

#[tauri::command]
pub async fn install_patch(
    app: AppHandle,
    patch_path: String,
) -> Result<String, String> {
    let patch_file = Path::new(&patch_path);
    
    if !patch_file.exists() {
        return Err("Patch file not found".to_string());
    }

    // Create temp directory for extraction
    let app_dir = app
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data dir")?;
    
    let temp_dir = app_dir.join("patch_temp");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    // Extract zip file
    log::info!("Extracting patch file...");
    let file = fs::File::open(&patch_file).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    archive.extract(&temp_dir).map_err(|e| e.to_string())?;

    // Load and verify manifest
    log::info!("Verifying patch integrity...");
    let manifest_path = temp_dir.join("manifest.json");
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|_| "Manifest file not found in patch".to_string())?;
    
    let manifest: PatchManifest = serde_json::from_str(&manifest_content)
        .map_err(|e| format!("Invalid manifest: {}", e))?;

    // Verify checksums
    verify_patch_checksums(&temp_dir, &manifest)?;

    // Install patch files
    log::info!("Installing patch version {}...", manifest.version);
    install_patch_files(&app, &temp_dir)?;

    // Cleanup
    fs::remove_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    Ok(format!("Patch {} installed successfully", manifest.version))
}

fn verify_patch_checksums(
    temp_dir: &Path,
    manifest: &PatchManifest,
) -> Result<(), String> {
    for (file_path, expected_checksum) in &manifest.checksums {
        let full_path = temp_dir.join(file_path);
        
        if file_path != "manifest.json" && !full_path.exists() {
            continue; // Skip if file doesn't exist (optional files)
        }

        if full_path.is_file() {
            let content = fs::read(&full_path).map_err(|e| e.to_string())?;
            let mut hasher = Sha256::new();
            hasher.update(&content);
            let checksum = hex::encode(hasher.finalize());

            if checksum != *expected_checksum {
                return Err(format!(
                    "Checksum mismatch for {}: expected {}, got {}",
                    file_path, expected_checksum, checksum
                ));
            }
        }
    }

    Ok(())
}

fn install_patch_files(app: &AppHandle, temp_dir: &Path) -> Result<(), String> {
    let app_dir = app
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data dir")?;

    // Install frontend files
    let frontend_src = temp_dir.join("frontend");
    if frontend_src.exists() {
        let frontend_dest = app_dir.join("frontend");
        fs::create_dir_all(&frontend_dest).map_err(|e| e.to_string())?;
        copy_dir_recursive(&frontend_src, &frontend_dest)?;
        log::info!("Frontend files installed");
    }

    // Install backend files
    let backend_src = temp_dir.join("backend");
    if backend_src.exists() {
        let backend_dest = app_dir.join("backend");
        fs::create_dir_all(&backend_dest).map_err(|e| e.to_string())?;
        copy_dir_recursive(&backend_src, &backend_dest)?;
        log::info!("Backend files installed");
    }

    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = entry.file_name();
        let dest_path = dest.join(&file_name);

        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> Result<String, String> {
    let version = app.package_info().version.to_string();
    Ok(version)
}
