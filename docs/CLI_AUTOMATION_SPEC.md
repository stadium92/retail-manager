# 🤖 Retail Manager CLI & AI Agent Specification

**Goal**: Build a custom Command Line Interface (CLI) to accelerate development by 10x.
**Name**: `retail-cli` (or just `r`)
**Technology**: Rust (using `clap`) or Node.js (using `commander`). Rust is preferred for speed and single-binary distribution.

---

## 1. Core Commands

### 🔑 Licensing & Sales
*   `retail-cli license generate <customer_name> --expiry "lifetime"`
    *   **Action**: Generates a cryptographically signed license key for your 50k FCFA Flash Sale customers.
    *   **Output**: `LICENSE-KEY-1234-ABCD` (Save to `sales.db` locally).

### 🚀 Feature Development (The "AI Agent" Part)
*   `retail-cli scaffold feature <name>`
    *   **Action**: Creates a new feature branch, sets up folder structure in `frontend/src/features/<name>`, and adds a default route.
    *   **Example**: `retail-cli scaffold feature "BulkImport"`

*   `retail-cli agent implement <task_description>`
    *   **Action**: Connects to your local LLM (Ollama/Llama 3) or API (OpenAI/Anthropic).
    *   **Input**: "Create a React component for a sortable table with 5 columns."
    *   **Output**: Writes the code directly to `src/components/Table.tsx`.

### 🛠 Maintenance & Quality
*   `retail-cli doctor`
    *   **Action**: Checks health of the project.
    *   **Checks**: Database integrity, Unused imports, TypeScript errors, Rust compilation status.

*   `retail-cli test`
    *   **Action**: Runs backend (Rust) and frontend (Vitest) tests in parallel.

### 📦 Deployment & Updates
*   `retail-cli build release`
    *   **Action**: Builds the Tauri app for macOS/Windows, optimizes assets, and creates the installer.

*   `retail-cli publish`
    *   **Action**: Uploads the installer to GitHub Releases and updates the auto-updater JSON.

---

## 2. Implementation Plan (MVP)

### Step 1: The License Generator (Immediate Need)
You need this **Right Now** for your 50k Flash Sale.
We will write a small Rust script in `tools/keygen` to generate secure keys.

### Step 2: The Scaffolder
We will create a script that copies templates for new Components/Pages so you don't copy-paste boilerplate code.

### Step 3: The AI Helper
We will integrate a simple python script that takes a prompt and uses your API key to generate code snippets and save them to a file.

---

## 3. Recommended Tech Stack
-   **Language**: Rust (consistent with your backend).
-   **Libraries**:
    -   `clap`: For parsing command line arguments.
    -   `inquire`: For interactive prompts (Select options, Confirmations).
    -   `fs_extra`: For file operations.
    -   `reqwest`: For calling AI APIs.
