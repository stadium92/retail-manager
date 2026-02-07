# 🛠 Windows ARM64 Development Environment & 32-bit Build Patterns

This document serves as a blueprint for rebuilding the development environment on a fresh Windows ARM64 installation, specifically focused on building 32-bit applications and managing system constraints.

---

## 💻 Hardware Context
- **Architecture**: ARM64 (Windows on ARM)
- **Primary Goal**: Building/Packaging 32-bit (x86) applications from an ARM64 host.

---

## 📦 Required Software Checklist

### 1. Development Tools
- **Visual Studio Community 2022**:
  - *Must include*: 
    - Desktop development with C++
    - **MSVC v143 - VS 2022 C++ ARM64 build tools**
    - **MSVC v143 - VS 2022 C++ x64/x86 build tools**
    - Windows 11 SDK
- **Rust (rustup)**:
  - Add targets: `rustup target add i686-pc-windows-msvc` (for 32-bit)
- **Node.js**: (LTS recommended)
- **Git for Windows**: Essential for version control.

### 2. CLI & Ecosystem
- **Gemini CLI**: Ensure you have your API key and setup script ready.
- **Package Managers**: `npm`, `cargo` (via Rust).

---

## 🏗 Key Build Pattern: 32-bit Node.js Sidecar for Tauri

When standard packaging tools like `pkg` fail due to cross-architecture or missing 32-bit binaries on an ARM64 host, use this **Rust Wrapper Pattern**:

### The Problem
- Packaging a Node.js app as a 32-bit sidecar on ARM64 often fails because the packaging tools cannot find the correct 32-bit Node headers or binaries for the target arch.

### The Solution: The Rust "Shim"
1. **Prepare Payload**: 
   - Bundle your Node.js code and a 32-bit `node.exe` into a `.zip` or embed them directly.
2. **Rust Wrapper**:
   - Create a simple Rust program targeted at `i686-pc-windows-msvc`.
   - Use `include_bytes!` to embed the Node.js payload inside the Rust binary.
   - At runtime, the Rust binary extracts the payload to a temp directory and executes it.
3. **Integration**:
   - Use this Rust-produced `.exe` as the sidecar in your `tauri.conf.json`.

---

## 🚀 Reinstallation Tutorial

### Phase 1: OS & Basic Setup
1. Install Windows ARM64.
2. Run Windows Update immediately.
3. **Proactive Space Management**: 
   - Disable Reserved Storage: `dism /online /Set-ReservedStorageState /State:Disabled`
   - (Optional) Use CompactOS: `compact.exe /CompactOS:always`

### Phase 2: Environment
1. **Install Git**: Download from `git-scm.com`.
2. **Install Visual Studio**: Select the C++ components mentioned above.
3. **Install Rust**: Use `rustup`. Add the 32-bit target: `rustup target add i686-pc-windows-msvc`.
4. **Install Gemini CLI**: Re-authenticate and link your project.

### Phase 3: Project Recovery
1. Clone your project from Git.
2. Navigate to `MVP/memory-bank` to refresh project context.
3. Use the **Rust Wrapper Pattern** documented here for sidecar builds.

---

## 📝 Prompt for the Next Run
*If you are starting a new session with Gemini CLI after reinstallation, use this prompt:*

> "I have just reinstalled my Windows ARM64 system. I am working on the MVP project located in `C:\Users\mohamedcoulibaly\MVP`. Please read `memory-bank/tech/windows_arm64_setup.md` to understand my build patterns (especially the 32-bit Rust wrapper for Node.js sidecars) and help me verify my environment setup."
