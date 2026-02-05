<context>
# Overview
The Product Scanning feature is a critical enhancement for the Retail Manager application, enabling Store Owners to leverage their smartphone cameras for barcode scanning. This feature drastically streamlines inventory management and sales processes by reducing manual data entry, minimizing errors, and providing a modern, efficient user experience. It allows for instant product lookups and rapid inventory addition.

# Core Features
## 1. Camera-Based Barcode Scanning
- **What it does**: Uses the device's camera to capture and decode standard retail barcodes (EAN-13, UPC, etc.).
- **Why it's important**: Eliminates the need for external barcode scanning hardware and speeds up operations compared to typing.
- **How it works**: A scanner overlay appears on screen; when a barcode is detected within the frame, it is automatically decoded and the value is returned to the active form.

## 2. Inventory Search Integration
- **What it does**: Adds a scanning trigger to the inventory search bar.
- **Why it's important**: Allows owners to find product details, stock levels, and pricing instantly by scanning the item in hand.
- **How it works**: Clicking a scan icon opens the camera; scanning a code populates the search field and triggers the search.

## 3. Quick Product Addition
- **What it does**: Integrates scanning into the "Add Product" workflow.
- **Why it's important**: Ensures accurate capturing of SKU/Barcode data when entering new inventory.
- **How it works**: A "Scan" button in the product form captures the barcode and fills the respective input field.

## User Stories & Functional Requirements
- **As a store owner/worker**, I want to scan a product barcode while searching in inventory so that I don't have to type the name or SKU.
- **As a store owner**, I want to scan a barcode when adding a new product so that the SKU/Barcode field is auto-filled.
- **As a worker**, I want to scan a product barcode when recording a new sale to quickly add the item to the cart without searching for it manually.

# User Experience
## User Personas
- **Store Owner (Master)**: Needs efficiency and accuracy. Often managing stock on the floor and doesn't want to walk back to a computer to type in numbers.

## Key User Flows
### Inventory Search Flow
1.  User taps "Search" input.
2.  User taps the **Camera/Scan icon**.
3.  Camera overlay opens with a guide frame.
4.  User points camera at product barcode.
5.  App detects code, providing visual/haptic feedback.
6.  Camera closes, search field is populated, and results are shown.

### Add Product Flow
1.  User opens "Add Product" form.
2.  User taps **"Scan Barcode"** next to the SKU field.
3.  Camera opens and captures the code.
4.  SKU field is auto-filled with the scanned number.

## UI/UX Considerations
- **Feedback**: Immediate visual confirmation (e.g., green frame, flash) when a code is scanned.
- **Accessibility**: Clear error messages if camera permission is denied.
- **Ease of Use**: Large, accessible close buttons and clear target frames.
</context>

<PRD>
# Technical Architecture
## System Components
- **Frontend**: React-based PWA (Lovable/Vite stack).
- **Scanner Library**: `react-zxing`, `html5-qrcode`, or `react-qr-reader`.
- **Hardware Integration**: HTML5 MediaDevices API (`navigator.mediaDevices.getUserMedia`) for camera access.

## Data Models
- **Barcode Format**: String (standard formats like EAN-13, UPC-A, EAN-8).
- **Integration**: Feeds into existing `Product` model's `barcode` or `sku` fields.

## Infrastructure Requirements
- **HTTPS**: Required for camera access on mobile browsers.
- **Mobile Browser Compatibility**: Chrome (Android), Safari (iOS).

# Development Roadmap
## Phase 1: MVP
- Implement `BarcodeScanner` component with basic EAN/UPC support.
- Integrate into **Inventory Search**.
- Integrate into **Add Product Form**.
- Handle basic camera permissions and error states.

## Phase 2: Future Enhancements
- **Batch Scanning**: Scan multiple items in rapid succession (e.g., for stock taking).
- **Lookup External API**: Auto-fill product details (name, image) from open product databases (e.g., Open Food Facts) upon scan.
- **Sales Terminal**: Integrate scanning into the Point of Sale (POS) view for workers.

# Logical Dependency Chain
1.  **Scanner Component**: Build the core independent component that handles the camera feed and decoding.
2.  **Permission Handling**: Ensure robust error handling for denied permissions before integrating into main flows.
3.  **Search Integration**: Hook the scanner result into the existing inventory search state.
4.  **Form Integration**: Hook the scanner result into the `react-hook-form` (or similar) state for adding products.

# Risks and Mitigations
## Technical Challenges
- **Risk**: Lighting conditions affecting scan performance.
    - *Mitigation*: Use a library with robust image processing; advise user to turn on light (if flash control API available).
- **Risk**: Camera permissions denied by user.
    - *Mitigation*: Clear "Enable Camera" UI with instructions; always offer manual entry fallback.
- **Risk**: Low-quality cameras on older devices.
    - *Mitigation*: Ensure UI allows for easy manual correction/entry.

## Resource Constraints
- **Risk**: Library size affecting bundle.
    - *Mitigation*: Use lightweight libraries or dynamic imports for the scanner component.

# Appendix
## Recommended Libraries
- `react-zxing`: Modern, hook-based, lightweight.
- `html5-qrcode`: Robust, supports many formats, widely used.
</PRD>

---


