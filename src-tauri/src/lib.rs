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
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_log::Builder::default()
      .targets([
        Target::new(TargetKind::Stdout),
        Target::new(TargetKind::LogDir { file_name: None }),
        Target::new(TargetKind::Webview),
      ])
      .build())
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
      use std::fs::{self, OpenOptions};
      use std::io::Write;
      use std::path::PathBuf;
      let shell = app.shell();
      
      let mut log_path = if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
          PathBuf::from(local_app_data).join("retail-manager-logs")
      } else {
          std::env::temp_dir().join("retail-manager-logs")
      };
      
      if !log_path.exists() {
          let _ = fs::create_dir_all(&log_path);
      }
      log_path.push("tauri-debug.log");

      let mut file = OpenOptions::new().create(true).append(true).open(log_path).unwrap();
      let _ = writeln!(file, "App starting... {}", std::env::consts::ARCH);

      match shell.sidecar("local-bridge") {
        Ok(sidecar_command) => {
          // Hand the backend its crash-reporting config.
          //
          // The sidecar is compiled with plain tsc (no bundler define step)
          // and Tauri spawns it with no environment of its own, so there was
          // previously no way for the bridge to learn a DSN at all. It reads
          // SENTRY_DSN from its environment; this is the only place that can
          // supply it on a real install.
          //
          // option_env! resolves at COMPILE time: when CI builds with
          // SENTRY_DSN set the value is baked in, and when it is not the
          // backend simply runs unmonitored exactly as it does today. No
          // DSN is committed to the repository.
          let sidecar_command = match option_env!("SENTRY_DSN") {
            Some(dsn) if !dsn.is_empty() => sidecar_command
              .env("SENTRY_DSN", dsn)
              .env("APP_VERSION", env!("CARGO_PKG_VERSION"))
              .env("CLIENT_ID", option_env!("CLIENT_ID").unwrap_or("unknown")),
            _ => sidecar_command,
          };
          match sidecar_command.spawn() {
            Ok((mut rx, _child)) => {
              let _ = writeln!(file, "Sidecar spawn command successful.");
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
            }
            Err(e) => {
              let _ = writeln!(file, "Failed to spawn sidecar: {}", e);
              log::error!("Failed to spawn sidecar: {}", e);
            }
          }
        }
        Err(e) => {
          let _ = writeln!(file, "Failed to create sidecar command: {}", e);
          log::error!("Failed to create sidecar command: {}", e);
        }
      }

      log::info!("Tauri core initialized.");
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_app_handle, event| match event {
      tauri::RunEvent::ExitRequested { .. } => {
        // Tauri cleans up sidecars automatically, but the build() -> run() 
        // pattern ensures we have a hook if we need manual cleanup.
      }
      _ => {}
    });
}
