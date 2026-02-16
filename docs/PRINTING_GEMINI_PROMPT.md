# Gemini Prompt (derived from PRINTING_PRD)

Use-case: Provide this prompt to an LLM (Gemini) to generate code, configuration, or assistant flows for printing receipts. The prompt is intentionally verbose and explicit about data models, messages, UI, and integration constraints.

---

You are an expert software engineer. Implement a reliable receipt printing feature inside an existing Tauri + React app. Follow these explicit constraints and outputs.

Context:
- A receipt HTML template is at `templates/ticket-centered.html` and a PDF generator script exists at `scripts/generate-pdf.js`.
- The app is a Tauri desktop app with a React frontend.
- The app must prefer printing to a recognized local printer via a socket-based protocol, otherwise fallback to offering a PDF download.

Requirements (do these exactly):
1. Add a `PrinterContext` in React that exposes `printers`, `defaultPrinterId`, `discoverPrinters()`, `setDefaultPrinter()`, `printReceipt()`.
2. Add Tauri commands: `discover_printers`, `get_printers`, `set_default_printer`, `print_receipt`, `download_receipt`. Use JSON-friendly inputs and outputs.
3. Implement a WebSocket JSON protocol with messages: `register`, `register_ack`, `print`, `print_ack`, `print_result`, `ping/pong`. Supply examples.
4. Security: include an ephemeral `token` returned on registration. The print job must include the token.
5. UI: `ReceiptView` shows `Print` (primary) and `Download` (secondary). If `defaultPrinterId` exists and `autoPrint` is true, `Print` sends to that printer. If no printers available, `Print` opens the download dialog.
6. Log `print_started` and `print_result` events to local logs.
7. Provide a `printer-agent` simulator (a small Node script) that accepts WebSocket registration and print requests and writes the PDF to `./dev-print-jobs/<jobId>.pdf` and returns `print_result`.

Outputs I want from you (when you are asked to execute):
- A `PrinterContext` code example (React + TypeScript) with method signatures.
- The Tauri Rust command stubs for `lib.rs` that register handlers.
- The Node-based `printer-agent` simulator script.
- Example WebSocket messages for a `print` job (complete with base64 placeholder).

Extra: Provide a short `test-plan` describing how to validate the flow locally (including the `printer-agent` simulator steps).

Placeholders / Replacement rules (for tickets and store names):
- All tickets must replace `{{storeName}}`, `{{storeAddress}}`, `{{phone}}`, `{{invoice}}`, `{{date}}`, `{{cashier}}`, and items in `{{#items}}...{{/items}}`.
- Provide a helper JSON mapping and an example payload (from `data/sample-ticket.json`) and show how the LLM should transform them into the final PDF.

Be explicit and produce code or pseudo-code blocks that can be run or adapted.

---

Example variables available to the LLM request:
- `invoice` (string), `storeName` (string), `storeAddress` (string), `phone` (string), `items` (array of {name, qty, price}), `subtotal`, `discount`, `total`, `date`, `cashier`.

