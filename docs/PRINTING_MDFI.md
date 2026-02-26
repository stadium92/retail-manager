# Printing MDFI — Machine-Directed Feature Implementation

Purpose: Convert PRD into concrete pages, data contracts, API endpoints, and implementation tasks (developer-ready). This file is intended to be machine-readable and used by automation (or an LLM) to scaffold work.

## Pages / Components

1. `ReceiptView`
- Inputs: `invoiceId`
- Actions: `printReceipt()`, `downloadReceipt()`
- Visuals: `Print` primary button (enabled only if `printer.ready` else shows downarrow/menu), `Download` secondary

2. `PrinterSetupModal`
- Lists: `discoveredPrinters[]`
- Actions: `addPrinter(printerId)`, `setDefault(printerId)`, `testPrint(printerId)`

3. `PrintStatusBar`
- Small component shows: `Printer: <name> (ready|busy|offline)` and `Test print` link

## Data Contracts

- `Printer` (see PRD JSON)
- `PrintJob`:
  - `jobId` string
  - `invoiceId` string
  - `printerId` string
  - `status` `queued|started|printed|error`
  - `timestamp`

## Local API (Tauri commands)

- `discover_printers(): Promise<Printer[]>`
- `get_printers(): Promise<Printer[]>`
- `set_default_printer(printerId: string): Promise<void>`
- `print_receipt({ jobId, invoiceId, printerId, pdfBase64 }): Promise<{status}>`
- `download_receipt({ invoiceId }): Promise<string /*filePath*/>`

## Socket messages (JSON)
- `register` — agent -> app
- `register_ack` — app -> agent
- `print` — app -> agent (contains `pdfBase64`)
- `print_ack` — agent -> app
- `print_result` — agent -> app

## Tasks (developer)
- T1: Add Tauri commands (stubs) into `src-tauri/src/lib.rs` and handlers.
- T2: Add frontend `PrinterContext` to maintain `printers[]`, `defaultPrinterId`, and methods.
- T3: Implement `PrinterSetupModal` and `PrintStatusBar` components and wire to context.
- T4: Implement `print_receipt` server-side handoff to either system print API or WebSocket send.
- T5: Create a `printer-agent` small repo/binary with WebSocket server and platform printing glue.
- T6: Add E2E test harness: `scripts/print-agent-sim.js` that accepts WebSocket connections and simulates printing.

## Example CLI / Dev commands
- `pnpm run preview:ticket` — generate PDF and open it.
- `pnpm run start:print-agent` — start local printer agent simulator (dev only).

## File references
- Template: [templates/ticket-centered.html](templates/ticket-centered.html)
- PDF generator: [scripts/generate-pdf.js](scripts/generate-pdf.js)
- Tauri code location: [src-tauri](src-tauri)


