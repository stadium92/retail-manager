# Onboarding Prompt for Windows VM (Parallels)

**Copy and paste the text below into your Gemini CLI on Windows:**

---

"Hello. I am working on the **Retail Manager** project. We have already successfully built the macOS version, and now we are in this Windows VM (Parallels) to build the **32-bit Windows (.exe)** installer.

### **1. Setup & Environment**
- I have already installed GitHub and connected my account.
- Please navigate to my work directory (create it if it doesn't exist): `C:\Users\mohamedcoulibaly\MVP\Pro`
- **Clone the repository:** `https://github.com/mohcly/retail-manager.git`
- **Target Branch:** `frontend-test-1`
- **Directory Name:** `retail-manager`
- **Submodules:** Please ensure you initialize and update the submodules after cloning.

### **2. Gather Context**
Before doing anything, **rigorously read the `memory-bank/` directory**. 
- Pay special attention to `core/context/techContext.md` (Multi-Platform Build section) and `core/tasks.md` (Task 11: Windows Deployment).
- You must understand the **CommonJS requirement** for the backend and the **Node 18 vs Node 20** version mismatch for `better-sqlite3`.

### **3. Mission: Build for Windows**
Your primary goal is to generate a working 32-bit Windows executable.
1.  Verify that the `backend/local-bridge` is correctly set up.
2.  Run the Windows sidecar build script: `.\scripts\build-sidecar.ps1` (PowerShell).
3.  Perform the full Tauri build targeting 32-bit: `tauri build --target i686-pc-windows-msvc`.

Please acknowledge that you have read the memory bank and are ready to proceed with the Windows build."
---
