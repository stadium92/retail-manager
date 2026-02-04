use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_log::{Target, TargetKind};

mod patch;
mod license;
mod printer;
mod scanner;
use patch::{install_patch, get_app_version};
use license::{
  validate_license_command, 
  activate_license_command, 
  get_license_status_command, 
  get_device_hash_command
};
use printer::{
  discover_printers,
  set_default_printer,
  print_receipt,
  download_receipt
};
use scanner::{
  start_hardware_scan_listener,
  list_connected_scanners,
  simulate_hardware_scan
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_log::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
      install_patch, 
      get_app_version,
      validate_license_command,
      activate_license_command,
      get_license_status_command,
      get_device_hash_command,
      discover_printers,
      set_default_printer,
      print_receipt,
      download_receipt,
      start_hardware_scan_listener,
      list_connected_scanners,
      simulate_hardware_scan
    ])
    .setup(|app| {
      let shell = app.shell();
      let sidecar_command = shell.sidecar("local-bridge").map_err(|e| {
        log::error!("Failed to create sidecar command: {}", e);
        e
      }).unwrap();

      let (mut rx, _child) = sidecar_command.spawn().map_err(|e| {
        log::error!("Failed to spawn sidecar: {}", e);
        e
      }).unwrap();

      // Create a background task to pipe sidecar logs to Tauri logs
      tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
          match event {
            CommandEvent::Stdout(line) => {
              log::info!("Sidecar: {}", String::from_utf8_lossy(&line).trim());
            }
            CommandEvent::Stderr(line) => {
              log::error!("Sidecar Error: {}", String::from_utf8_lossy(&line).trim());
            }
            CommandEvent::Terminated(payload) => {
              log::warn!("Sidecar terminated with exit code: {:?}", payload.code);
            }
            _ => {}
          }
        }
      });

      log::info!("Tauri core initialized and sidecar spawn attempted.");
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
