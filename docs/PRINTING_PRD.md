# Printing & Receipt Delivery — Product Requirements Document (PRD)

Status: Draft
Author: Team Retail Manager
Date: 2026-02-04

## 1. Overview

Goal: Provide a reliable, user-friendly receipt printing and delivery flow for the Retail Manager app that: (a) prints receipts to a specific, recognized printer when available, (b) falls back to a downloadable PDF when printing is unavailable, and (c) exposes an extensible socket-based interface for local printer agents and network printers. The system must work cross-platform (macOS, Windows, Linux) inside the Tauri app and via the web frontend when applicable.

Success metrics:
- 98% successful print jobs when a configured/recognized printer is available on the same network or machine.
- Clear fallback to download for all non-printable cases.
- Minimal user setup: install local printer agent or configure a discovered printer once.
- Audit/logging for print events (time, cashier, invoice id, printer id, status).

## 2. Stakeholders
- Product owner: defines acceptable UX and settings.
- Cashiers / Store staff: primary users who print receipts.
- IT / Admin: configures printers and installs printer agents if required.
- Development: implements Tauri + backend support and printer agent integration.

## 3. Non-Goals
- Replacing full print-spooler drivers. The system will rely on platform printing agents or an optional lightweight printer agent.
- Complex remote cloud printing — only local/lan printing and local agent integration are required in this phase.

## 4. Requirements

Functional requirements
- R1: The app exposes a `Print` action on the receipt view.
- R2: When the user presses `Print`, the app checks for a configured/recognized printer.
- R3: If a recognized printer is available, the app sends the printable PDF to that printer automatically (no extra dialogs). A user confirmation for 'Start printing' can be optionally requested via settings.
- R4: If no recognized printer is present or the print fails, the app disables/greys-out the automatic print option and offers a `Download PDF` action.
- R5: The app provides a printer discovery UI and a `Set default printer` setting.
- R6: The app supports a socket-based protocol (WebSocket + small JSON messages) so that a local printer agent or a networked printer can connect and register itself.
- R7: Printer agents must be able to register capabilities (paper width, supported formats, printer name, status) with the app.
- R8: The app sends receipts as PDF blobs (base64 or binary over an endpoint) to the registered printer agent or prints locally using the system print API.
- R9: The app logs print attempts and outcomes to a local log and optionally the remote analytics endpoint.

Non-functional requirements
- N1: Print latency: < 3 seconds to hand off to a local printer agent (excluding physical printing time).
- N2: Secure local prints: signed payloads (HMAC using local key) or ephemeral tokens between app and agent to reduce spoofing.
- N3: Offline friendly: printing must work without internet if the printer agent is local and present.
- N4: Cross-platform compatibility: macOS/Windows/Linux (for both the app & optional local agent).

## 5. Key Flows

Flow A — Automatic print (preferred)
1. User taps `Print` on the receipt.
2. App checks `defaultPrinter` setting and `discoveredPrinters` list.
3. If a ready printer is found, app generates the PDF (from the chosen template) and sends it to the printer endpoint via WebSocket or local system print API.
4. App shows a brief status toast (`Printing on <printerName>`) and records a `print_started` event.
5. When the printer agent replies `printed` or `error`, app updates UI and logs (`print_success` or `print_failed`).

Flow B — No printer available → Download fallback
1. User taps `Print` and no printer is available.
2. App immediately offers `Download receipt` (PDF) and `Open printer setup` actions.
3. If user chooses `Download`, the PDF is saved to `~/Downloads` and a success toast is shown.

Flow C — Discovery & Setup
1. On first-run or on-demand, the app attempts local discovery using mDNS/zeroconf (for networked agents) and local USB/CUPS queries if the platform allows.
2. If discovery yields candidates, the UI shows `Found printers` with `Add` buttons.
3. If discovery fails, the UI explains how to install the Local Printer Agent and provides a one-click link to download the agent.

## 6. Data Model & Configuration

Printer model (example JSON):
{
  "id": "printer-uuid",
  "name": "EPSON-T88IV-01",
  "type": "agent|system|ipp",
  "capabilities": { "paperWidthsMm": [58,80], "color": false, "dpi": 203 },
  "endpoint": "ws://192.168.1.22:4200",
  "lastSeen": "2026-02-04T...",
  "status": "ready|busy|offline"
}

Settings (in app store):
- `defaultPrinterId` (string | null)
- `autoPrint` (boolean) — if true, send to default printer automatically
- `requireConfirmationBeforePrint` (boolean)
- `paperSize` (e.g. 80mm, 58mm)

## 7. Socket Protocol (WebSocket JSON)

Why sockets: sockets keep a persistent low-latency channel to local agents and allow the agent to push status updates to the app. WebSocket is chosen as portable and easy to implement.

Registration (agent -> app):
- Message: `{ "type":"register", "payload": { "id":"printer-uuid", "name":"EPSON", "capabilities":{...} } }`
- App responds: `{ "type":"register_ack", "payload": { "accepted": true, "token": "ephemeral-token" } }`

Print request (app -> agent):
- Message: `{ "type":"print", "payload":{ "token":"ephemeral-token", "jobId":"JOB-123", "filename":"receipt.pdf", "pdfBase64":"<base64>" } }`
- Agent responds: `{ "type":"print_ack", "payload": { "jobId":"JOB-123", "status":"started" } }`

Print result (agent -> app):
- Message: `{ "type":"print_result", "payload": { "jobId":"JOB-123", "status":"printed|error", "message":"optional" } }`

Heartbeat/keepalive: `{ "type":"ping" }` / `{ "type":"pong" }`

Security: ephemeral tokens, optionally signed HMAC headers per job.

## 8. Implementation Notes

Architecture options:
- Option A (recommended): App + Local Printer Agent. The agent is a small node/Go/Rust binary the store installs; it exposes a WebSocket and uses OS print APIs (CUPS on Linux/mac, Win32 Print on Windows). The app discovers agents via mDNS or by listening for agent connections on a configured port.
- Option B: App uses the system printing APIs directly (Tauri or platform shell) when the OS exposes printer lists. This works on the same machine only (not on separate printer boxes on the LAN). Use when Tauri has access to native libs or by spawning system print commands.

Tauri specifics:
- Use Tauri commands to generate PDF (existing `scripts/generate-pdf.js` or native rendering). The Tauri backend will call PDF generator and then hand the buffer to the chosen print endpoint.
- Add new invoke commands: `discoverPrinters()`, `registerPrinter()`, `printReceipt(job)`, `getPrinters()`.

File references & code links:
- Receipt template: [templates/ticket-centered.html](templates/ticket-centered.html)
- PDF generator: [scripts/generate-pdf.js](scripts/generate-pdf.js)
- Tauri sidecar and commands: [src-tauri](src-tauri)

## 9. UI/UX

Screens / components:
- Receipt view: `Print` (primary) and `Download` (secondary) actions.
- Printer status bar: small indicator (green/orange/gray) showing `Printer: <name> (ready)` or `No printers`.
- Printer setup modal: lists discovered printers, `Add` / `Set default` / `Test print` buttons.
- Admin settings: `Install local agent` link, `auto-print` toggle, `paper size` selector.

Edge cases:
- If the default printer goes offline mid-job, show `Printing failed — try again or download`.
- If multiple printers share a name, show lastSeen IP and type to disambiguate.

## 10. Acceptance Criteria
- AC1: When a discovered `defaultPrinter` is `ready`, pressing `Print` results in a `print_started` followed by `print_result`=printed in logs within 30s.
- AC2: If no printer is discovered, `Print` button offers `Download` and explains steps to add a printer.
- AC3: App stores `defaultPrinterId` and honors `autoPrint` setting across launches.

## 11. Rollout & Testing

- Provide a Local Printer Agent binary for macOS/Windows/Linux with self-hosted downloads.
- Beta test in 2 stores with real receipt printers (EPSON/Thermal) and collect logs.
- End-to-end tests: simulated agent that accepts WebSocket connections and verifies PDF base64 receipt printing.

## 12. Implementation Roadmap and Timeline (example)
- Week 1: PRD sign-off, socket protocol and data model finalized, starter Local Agent skeleton.
- Week 2: App discovery, UI for printer setup, PDF handoff flow implemented.
- Week 3: Agent printing integration, test prints, logging and HMAC security.
- Week 4: Beta, fixes, documentation and packaging of agent.

## 13. Appendix: Sample messages and troubleshooting
- If the app shows `No printers`, ensure the agent is running, on the same network, and not blocked by firewall.
- Enable logging: `Settings → Diagnostics → Enable Print Logs`.


---
