# Ticket & PDF Templates

This folder contains two HTML templates and a simple Node script to generate PDFs from them.

Files
- `templates/ticket.html` — Narrow receipt-style template (for thermal printers / receipt format).
- `templates/invoice.html` — A4 invoice template.
- `scripts/generate-pdf.js` — Node script using Puppeteer to render an HTML template into PDF.
- `data/sample-ticket.json` — Sample data to test the ticket template.

Quick start
1. Install dependencies (in project root):

```bash
npm install puppeteer minimist
```

2. Generate an 80mm receipt PDF:

```bash
node scripts/generate-pdf.js --template=templates/ticket.html --data=data/sample-ticket.json --out=out/receipt.pdf
```

3. Generate an A4 invoice PDF:

```bash
node scripts/generate-pdf.js --template=templates/invoice.html --data=data/sample-ticket.json --out=out/invoice.pdf --a4=1
```

Integration notes
- In the Tauri app you can either:
  - Use the system printing API: open a print preview of a generated HTML view and let the system print to a physical printer or save as PDF.
  - Use the same HTML templates rendered inside a hidden `BrowserWindow` (or webview) and call `window.print()`.
  - Or keep using the Puppeteer script on a build server to produce PDFs for distribution.

- The templates are simple and use `{{key}}` placeholders and a `{{#items}}...{{/items}}` loop supported by the small replacer in `generate-pdf.js`.

Security & signing
- If tickets carry financial information that must be tamper-evident, embed a hash or sign the document and show a verification code on the ticket.
- For legal receipts consider adding registration/tax info and an invoice number format that your accountant requires.

Customization
- Change fonts, sizes, and language in the templates.
- For RTL languages or other locales, adapt CSS as needed.

Testing
- Open the HTML templates in a browser and check rendering.
- Run the sample script to generate PDFs and review the result.

If you want, I can:
- Integrate PDF generation into the app export flow (Tauri command that invokes Puppeteer or webview print).
- Add a signed hash to receipts for tamper detection.
- Provide a React component that previews the ticket and lets the cashier print directly.
