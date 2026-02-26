# CI/CD Pipeline Documentation (Feb 2026)

## Overview
This document describes the automated build and release pipeline implemented for the Retail Manager project.

## 1. Automated GitHub Actions Pipeline
The pipeline is defined in .github/workflows/build.yml. It automates the following steps on every push to the \main\ branch:
- **Setup**: Configures Node.js v18 and Rust with the \x86_64-pc-windows-msvc\ target.
- **Backend Build**: Compiles the Node.js sidecar (\ackend/local-bridge\).
- **Frontend Build**: Compiles the React frontend.
- **Sidecar Preparation**: Runs \scripts/prepare-sidecar-payload.ps1\ to:
    - Download Node.js v18.20.8 (x64).
    - Download better-sqlite3 v9.4.3 (ABI 108).
    - Bundle them into a payload.
    - Compile the Rust sidecar wrapper (\ackend/sidecar-wrapper\).
- **Tauri Build**: Executes \	auri build\ to generate the final Windows installer (NSIS).
- **Release**: Automatically creates a GitHub Release draft with the versioned installer.

## 2. Key Improvements for Portability
The \scripts/prepare-sidecar-payload.ps1\ was updated to remove environment-specific hardcoding:
- **Relative PROJECT_ROOT**: Uses \Resolve-Path "\\.."\ to locate the project root regardless of the machine's user path.
- **Portable Cargo**: Replaced hardcoded Cargo paths with a generic \cargo.exe\ call, relying on the system PATH (standard in CI/CD and local dev).

## 3. How to Trigger
- **Automatic**: Push changes to the \main\ branch.
- **Manual**: Go to the "Actions" tab in the GitHub repository, select "CI/CD Pipeline", and click "Run workflow".

## 4. Troubleshooting
- **Disk Space**: The local VM has limited space. If builds fail locally, rely on the GitHub Actions pipeline which runs on hosted runners with ample space.
- **Node/ABI Mismatch**: Ensure \NODE_ABI\ in \prepare-sidecar-payload.ps1\ matches the Node.js version (e.g., 108 for Node 18).
