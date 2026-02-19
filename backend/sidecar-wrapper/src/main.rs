use std::fs;
use std::io;
use std::process::Command;
use std::env;

fn main() {
    if let Err(e) = run() {
        use std::fs::OpenOptions;
        use std::io::Write;
        let log_path = "C:\\Users\\Mohamed\\Desktop\\wrapper-debug.log";
        if let Ok(mut log_file) = OpenOptions::new().create(true).append(true).open(log_path) {
            let _ = writeln!(log_file, "CRITICAL ERROR: {}", e);
        }
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    use std::fs::{self, OpenOptions};
    use std::io::{self, Write};
    use std::process::Command;
    use std::env;

    let log_path = "C:\\Users\\Mohamed\\Desktop\\wrapper-debug.log";
    let mut log_file = OpenOptions::new().create(true).append(true).open(log_path)?;

    writeln!(log_file, "--- Wrapper Starting (v2) ---")?;

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

    // Extract files
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
            // Overwrite file
            // writeln!(log_file, "Extracting: {:?}", outpath)?; // Too verbose, commenting out
            let mut outfile = fs::File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
        }
    }

    // Path to the bundled node executable
    let node_path = temp_dir.join("node.exe");
    // Path to the entry script
    let script_path = temp_dir.join("dist").join("index.js");

    writeln!(log_file, "Node Path: {:?}", node_path)?;
    writeln!(log_file, "Script Path: {:?}", script_path)?;

    if !node_path.exists() {
        writeln!(log_file, "CRITICAL: node.exe not found!")?;
        return Err(format!("Critical Error: node.exe not found at {:?}", node_path).into());
    }

    // Collect args passed to this executable
    let args: Vec<String> = env::args().skip(1).collect();
    writeln!(log_file, "Args: {:?}", args)?;

    writeln!(log_file, "Starting backend server via bundled Node...")?;
    writeln!(log_file, "Wrapper Architecture: {}", std::env::consts::ARCH)?;
    
    // Spawn the node process
    let mut child = Command::new(&node_path)
        .arg(&script_path)
        .args(args)
        .current_dir(&temp_dir) // Important for require() resolution
        .spawn();

    match child {
        Ok(mut child) => {
            writeln!(log_file, "Node process spawned successfully (PID: {:?})", child.id())?;
            
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
