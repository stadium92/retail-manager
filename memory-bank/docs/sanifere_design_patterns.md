# Sanifere Design Patterns & UI/UX Standards

This document summarizes the visual and interactive patterns identified in the Sanifere legacy system.

## Visual Design System

### 1. Color Palette
- **Backgrounds**: High-saturation Yellow (#FFFF00 style) or Teal Green.
- **Headers/Toolbars**: Deep Green (#006400) or Dark Teal.
- **Selection Highlights**: Red background with white text for active menu items.
- **Input Fields**: Bright green or cyan highlights indicating active focus.

### 2. Typography & Layout
- **Font**: Monospace or system sans-serif, optimized for maximum readability on low-res screens.
- **Density**: Extremely high. Every pixel is used to show data (Ref, Stock, Price, etc.) simultaneously.
- **Structure**: Consistent use of boxed "Fiches" (cards) that overlay the main window.

## Interactive Patterns

### 1. Keyboard-Centric Workflow
- **Function Keys (F1-F12)**: The primary way to trigger actions (Validate, Print, Search, Save).
- **Esc Key**: Standard way to go back or cancel current input.
- **Enter/Tab**: Rapid serial navigation through fields in a form.

### 2. Information Hierachy
- **3-Level Navigation**: Horizontal main menu -> Vertical dropdown -> Nested secondary dropdown.
- **Self-Documenting Headers**: Every screen clearly states its mode (e.g., "EDITION des FICHES", "MODIFICATION", "AJOUT").

### 3. Error Prevention & Feedback
- **Alert Colors**: Red cells in lists (like "Produits a Commander") to indicate critical stock levels or negative values.
- **Status Bar**: A bottom bar frequently used to explain what the current menu option does (e.g., "Production des rapports détaillés sur: imprimante, écran ou disque").

## Key UX Micro-Patterns
- **Real-time Stock Visibility**: During sale entry, the current stock of the highlighted product is immediately visible, reducing the need to switch screens.
- **Integrated History**: Seeing "Last Purchase Date" and "Last Sale Date" directly on the Product Card.
- **Denomination Billetage**: Forcing structured cash counting rather than just a total amount, reducing counting errors during register closing.
