use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::process::Command;
use std::env;
use std::path::PathBuf;

fn get_log_path() -> PathBuf {
    let mut path = if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        PathBuf::from(local_app_data).join("retail-manager-logs")
    } else {
        env::temp_dir().join("retail-manager-logs")
    };
    
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.join("wrapper-debug.log")
}

fn main() {
    if let Err(e) = run() {
        let log_path = get_log_path();
        if let Ok(mut log_file) = OpenOptions::new().create(true).append(true).open(log_path) {
            let _ = writeln!(log_file, "CRITICAL ERROR: {}", e);
        }
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let log_path = get_log_path();
    let mut log_file = OpenOptions::new().create(true).append(true).open(log_path)?;

    writeln!(log_file, "--- Wrapper Starting (v2.1) ---")?;

    // EMERGENCY CLEANUP: Kill any process on 8787
    #[cfg(windows)]
    {
        writeln!(log_file, "Cleaning up port 8787...")?;
        let _ = Command::new("powershell")
            .args(["-Command", "Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"])
            .status();
    }

    // Embed the architecture-specific payload zip
    // The PAYLOAD_FILE env var is set by the build script
    let payload = include_bytes!(env!("PAYLOAD_FILE"));
    let reader = std::io::Cursor::new(payload);
    let mut archive = zip::ZipArchive::new(reader)?;

    // Extract to a known temp directory
    let temp_dir = env::temp_dir().join("retail-manager-sidecar");
    writeln!(log_file, "Temp Dir: {:?}", temp_dir)?;
    
    // Create directory if it doesn't exist
    if !temp_dir.exists() {
        writeln!(log_file, "Creating temp dir...")?;
        fs::create_dir_all(&temp_dir)?;
    } else {
        writeln!(log_file, "Temp dir exists.")?;
    }

    // VERSION CHECK: Compare version.txt in zip with version.txt in temp_dir
    let mut needs_extraction = true;
    let local_version_path = temp_dir.join("version.txt");

    if local_version_path.exists() {
        if let Ok(mut zip_version_file) = archive.by_name("version.txt") {
            let mut zip_version = String::new();
            use std::io::Read;
            if zip_version_file.read_to_string(&mut zip_version).is_ok() {
                if let Ok(local_version) = fs::read_to_string(&local_version_path) {
                    if zip_version.trim() == local_version.trim() {
                        needs_extraction = false;
                        writeln!(log_file, "Version matches ({}). Skipping extraction.", zip_version.trim())?;
                    } else {
                        writeln!(log_file, "Version mismatch (Local: {}, Zip: {}). Re-extracting...", local_version.trim(), zip_version.trim())?;
                    }
                }
            }
        }
    }

    // INTEGRITY CHECK - must run AFTER the version check and be able to
    // override it. A matching version.txt only proves *a* payload of this
    // version was extracted here once, NOT that it is still intact. This
    // directory lives in %TEMP%, where Windows Storage Sense, "Disk Cleanup",
    // third-party cleaners and antivirus quarantine all delete files freely -
    // and they delete selectively, so version.txt routinely survives while
    // node.exe or dist/ do not. In that state the old logic saw a version
    // match, skipped extraction, then failed on missing node.exe and returned
    // the same error on every relaunch forever: a permanently broken install
    // that reinstalling the app does not fix, because the stale temp dir is
    // never touched. Re-extract whenever anything we actually need is absent.
    if !needs_extraction {
        let required = [
            temp_dir.join("node.exe"),
            temp_dir.join("dist").join("index.js"),
        ];
        if let Some(missing) = required.iter().find(|p| !p.exists()) {
            writeln!(
                log_file,
                "Version matched but {:?} is missing (temp dir was cleaned or quarantined). Forcing re-extraction.",
                missing
            )?;
            needs_extraction = true;
        }
    }

    // EXTRACTION
    if needs_extraction {
        // Drop the version marker first so a run that dies partway through
        // (disk full, antivirus grabbing a file mid-write, power loss) cannot
        // leave a directory that still *claims* to be a complete install of
        // this version. Worst case we re-extract once more next launch.
        let _ = fs::remove_file(&local_version_path);

        writeln!(log_file, "Extracting {} files...", archive.len())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = match file.enclosed_name() {
                Some(path) => temp_dir.join(path),
                None => continue,
            };

            // Check for directory (handles both / and \)
            if (*file.name()).ends_with('/') || (*file.name()).ends_with('\\') {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)?;
                    }
                }
                let mut outfile = fs::File::create(&outpath)?;
                io::copy(&mut file, &mut outfile)?;
            }
        }
    }

    // Path to the entry script
    let script_path = temp_dir.join("dist").join("index.js");
    // Path to the bundled node executable
    let node_path = temp_dir.join("node.exe");

    writeln!(log_file, "Node Path: {:?}", node_path)?;
    writeln!(log_file, "Script Path: {:?}", script_path)?;

    if !node_path.exists() {
        // Reaching here means node.exe is absent even though extraction just
        // ran (the integrity check above forces that). Overwhelmingly the
        // cause is antivirus quarantining an unsigned node.exe the instant it
        // lands in %TEMP%, which no amount of retrying will beat.
        writeln!(
            log_file,
            "CRITICAL: node.exe missing at {:?} immediately after extraction. \
             Almost certainly quarantined by antivirus - add an exclusion for \
             this folder, or reinstall with real-time protection paused.",
            node_path
        )?;
        return Err(format!(
            "Backend runtime (node.exe) was removed from {:?} right after being written. \
             This is normally antivirus quarantine - add an exclusion for that folder and relaunch.",
            temp_dir
        )
        .into());
    }

    // Collect args passed to this executable
    let args: Vec<String> = env::args().skip(1).collect();
    writeln!(log_file, "Args: {:?}", args)?;

    writeln!(log_file, "Starting backend server via bundled Node...")?;
    writeln!(log_file, "Wrapper Architecture: {}", std::env::consts::ARCH)?;
    
    // WATCHDOG: Start a thread to monitor if the parent process dies
    let parent_pid = {
        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            // On Windows, we can use the current process to find our parent
            // But a simpler way is to just let the child die when the job object closes.
            // However, a dedicated thread is safer.
            std::process::id()
        }
        #[cfg(not(windows))]
        { std::process::id() }
    };

    // Baked in at compile time from the SUPABASE_SERVICE_KEY_BUILD build-time
    // env var (set by CI from a repo secret) — the sidecar has no other way
    // to reach a key on a machine it's freshly installed on. See env.ts for
    // the corresponding fallback SUPABASE_URL (no secret needed there).
    let supabase_service_key = option_env!("SUPABASE_SERVICE_KEY_BUILD").unwrap_or("");

    // Capture the child's stderr to its own file. Without this, node's output
    // was simply inherited and lost: when the backend died during startup all
    // we ever saw here was "spawned successfully" followed by "exited with
    // status 1", with no reason recorded anywhere. Anything that throws while
    // node is still loading modules - a corrupt or locked SQLite file, a
    // missing native binding - happens before the backend can install its own
    // logging, so this file is the ONLY place that error can appear.
    let stderr_path = get_log_path().with_file_name("backend-stderr.log");
    let stderr_file = OpenOptions::new().create(true).append(true).open(&stderr_path);
    writeln!(log_file, "Capturing backend stderr to {:?}", stderr_path)?;

    let mut cmd = Command::new(&node_path);
    cmd.arg(&script_path)
        .args(args)
        .current_dir(&temp_dir) // Important for require() resolution
        .env("SUPABASE_SERVICE_KEY", supabase_service_key);

    if let Ok(f) = stderr_file {
        cmd.stderr(std::process::Stdio::from(f));
    }

    // Spawn the node process
    let child = cmd.spawn();

    match child {
        Ok(mut child) => {
            let child_id = child.id();
            writeln!(log_file, "Node process spawned successfully (PID: {:?})", child_id)?;
            
            // Get current process info to find parent
            let current_pid = std::process::id();
            
            // WATCHDOG thread: Terminate if parent process dies
            std::thread::spawn(move || {
                use sysinfo::{System, Pid};
                let mut sys = System::new_all();
                
                // Find our parent PID
                let parent_pid = sys.process(Pid::from_u32(current_pid))
                    .and_then(|p| p.parent());

                if let Some(ppid) = parent_pid {
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(3));
                        sys.refresh_all();
                        if sys.process(ppid).is_none() {
                            // Parent is gone! Kill children and exit.
                            std::process::exit(0);
                        }
                    }
                }
            });

            #[cfg(windows)]
            {
                use windows_sys::Win32::System::JobObjects::*;
                use windows_sys::Win32::Foundation::*;
                use std::mem;
                use std::os::windows::io::AsRawHandle;

                unsafe {
                    let job = CreateJobObjectA(std::ptr::null(), std::ptr::null());
                    if job != 0 {
                        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = mem::zeroed();
                        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                        
                        SetInformationJobObject(
                            job,
                            JobObjectExtendedLimitInformation,
                            &info as *const _ as *const _,
                            mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                        );

                        let handle = child.as_raw_handle();
                        AssignProcessToJobObject(job, handle as HANDLE);
                    }
                }
            }

            // Wait for it to finish (keep this process alive)
            let status = child.wait()?;
            writeln!(log_file, "Node process exited with status: {:?}", status)?;
        }
        Err(e) => {
             writeln!(log_file, "FAILED to spawn node process: {}", e)?;
             return Err(e.into());
        }
    }

    Ok(())
}