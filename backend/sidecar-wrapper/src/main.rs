use std::env;
use std::fs;
use std::io::Cursor;
use std::process::{Command, Stdio};
use zip::ZipArchive;

#[cfg(windows)]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectA, SetInformationJobObject,
    JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

fn main() {
    let exe_path = env::current_exe().expect("Failed to get current exe path");
    
    let temp_dir = env::temp_dir().join(format!("retail-manager-sidecar-{}", 
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()));
    
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir).expect("Failed to create temp directory");
    }

    let payload_bytes = include_bytes!(env!("PAYLOAD_FILE"));
    let mut archive = ZipArchive::new(Cursor::new(payload_bytes)).expect("Failed to open zip");

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).expect("Failed to get file from zip");
        let outpath = temp_dir.join(file.name());

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).expect("Failed to create directory");
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(&p).expect("Failed to create parent directory");
                }
            }
            let mut outfile = fs::File::create(&outpath).expect("Failed to create output file");
            std::io::copy(&mut file, &mut outfile).expect("Failed to copy file");
        }
    }

    let node_exe = temp_dir.join("node.exe");
    let server_js = temp_dir.join("dist/index.js");

    #[cfg(windows)]
    let _job = unsafe {
        let job = CreateJobObjectA(std::ptr::null(), std::ptr::null());
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        job
    };

    let mut child = Command::new(node_exe)
        .arg(server_js)
        .current_dir(&temp_dir)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("Failed to spawn node process");

    #[cfg(windows)]
    unsafe {
        AssignProcessToJobObject(_job, child.as_raw_handle() as _);
    }

    let status = child.wait().expect("Failed to wait for child process");
    
    let _ = fs::remove_dir_all(&temp_dir);
    std::process::exit(status.code().unwrap_or(0));
}

#[cfg(windows)]
trait AsRawHandle {
    fn as_raw_handle(&self) -> *mut std::ffi::c_void;
}

#[cfg(windows)]
impl AsRawHandle for std::process::Child {
    fn as_raw_handle(&self) -> *mut std::ffi::c_void {
        use std::os::windows::io::AsRawHandle;
        AsRawHandle::as_raw_handle(self)
    }
}
