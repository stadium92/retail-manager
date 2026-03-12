# Lovable.dev Prompt (Frontend Generation)

**Instruction for Lovable**:
Please implement the **Product Scanning Feature** for the Retail Manager frontend, ensuring a premium, mobile-first experience.

### 1. New Dependencies
*   Install a barcode scanning library. **Recommendation**: `react-zxing` or `html5-qrcode`.

### 2. Create `BarcodeScanner` Component
*   **Path**: `src/components/shared/BarcodeScanner.tsx`.
*   **Props**:
    *   `onResult(result: string)`: Callback when a code is detected.
    *   `onClose()`: Callback to close the scanner UI.
    *   `isScanning`: Boolean to control visibility.
*   **UI/UX**:
    *   **Overlay**: Full-screen z-index overlay with a semi-transparent dark backdrop (`bg-black/80`).
    *   **Viewport**: A clear, centered square or rectangular frame indicating where to position the barcode.
    *   **Controls**: A prominent "Close" button (X icon) at the top right.
    *   **Feedback**: Visual cue (e.g., border flashes green) on successful scan.
    *   **Error State**: Friendly message if camera access is denied ("Please enable camera access to scan products").

### 3. Integrate into `MasterDashboard`
**A. Inventory Search**
*   **Component**: Update the main `InventorySearch` or `StoreManagement` component.
*   **UI**: Add a **Scan Icon** (Lucide `ScanBarcode`) inside the search input (right side).
*   **Logic**:
    *   Clicking icon sets `isScanning(true)`.
    *   On result: `setSearchTerm(code)`, `isScanning(false)`, and auto-trigger the search/filter.

**B. Add/Edit Product Form**
*   **Component**: Update the `ProductForm`.
*   **UI**: functionality for the **Barcode/SKU** field.
    *   Add a "Scan" button with icon next to the input.
*   **Logic**:
    *   Clicking button opens scanner.
    *   On result: Update the form field value programmatically.

### 4. Style & Aesthetics
*   **Design System**: Use existing Tailwind tokens.
*   **Responsiveness**: Ensure the camera video element fits the screen without scrolling on mobile.
*   **Icons**: Use `lucide-react`.

### 5. Implementation Example
```tsx
import { useState } from 'react';
import { useZxing } from 'react-zxing';

export const BarcodeScanner = ({ onResult, onClose }) => {
  const { ref } = useZxing({
    onDecodeResult(result) {
      onResult(result.getText());
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative w-full max-w-md p-4">
        <video ref={ref} className="w-full rounded-lg border-2 border-white/20" />
        <button onClick={onClose} className="absolute top-6 right-6 text-white p-2 bg-black/50 rounded-full">
          <XIcon />
        </button>
        <p className="text-white text-center mt-4">Point current camera at barcode</p>
      </div>
    </div>
  );
};
```
