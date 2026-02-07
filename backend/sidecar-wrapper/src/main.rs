use std::fs;
use std::io;
use std::process::Command;
use std::env;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Embed the payload zip
    let payload = include_bytes!("../../local-bridge/payload.zip");
    let reader = std::io::Cursor::new(payload);
    let mut archive = zip::ZipArchive::new(reader)?;

    // Extract to a known temp directory
    let temp_dir = env::temp_dir().join("retail-manager-sidecar");
    
    // Create directory if it doesn't exist
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)?;
    }

    // Extract files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = match file.enclosed_name() {
            Some(path) => temp_dir.join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)?;
                }
            }
            // Overwrite file
            let mut outfile = fs::File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
        }
    }

    // Path to the bundled node executable
    let node_path = temp_dir.join("node.exe");
    // Path to the entry script
    let script_path = temp_dir.join("dist").join("index.js");

    // Collect args passed to this executable
    let args: Vec<String> = env::args().skip(1).collect();

    // Spawn the node process
    let mut child = Command::new(node_path)
        .arg(script_path)
        .args(args)
        .current_dir(&temp_dir) // Important for require() resolution
        .spawn()?;

    // Wait for it to finish (keep this process alive)
    child.wait()?;

    Ok(())
}