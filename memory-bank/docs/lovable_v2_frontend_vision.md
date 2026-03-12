# Lovable Prompt: Retail Manager V2 - Modern POS Vision

## 🌟 The Goal
Transform a high-density legacy desktop POS (Sanifere) into a **premium, stunning, and high-performance Web POS**. The design must "WOW" the user with a rich, vibrant, and deep-themed aesthetic while maintaining the efficiency of a data-heavy enterprise tool.

## 🎨 Aesthetic Requirements (Vibe & Design)
- **Style**: "Cyberpunk Enterprise" or "Glassmorphic Dark Mode".
- **Color Palette**: Deep Indigo/Obsidian backgrounds, Neon Teal/Emerald accents (for success/stock), and Electric Amber (for alerts/low stock). Avoid flat colors. Use vibrant gradients.
- **Typography**: Modern, technical sans-serif (e.g., JetBrains Mono for data, Inter for UI).
- **Animations**: Smooth micro-transitions on hover. Rows should highlight with a subtle glow. Modals should have a soft spring entry.
- **Components**: Use Radix UI / Shadcn primitives but customize them to look premium (rounded 12px+ corners, subtle border glows, backdrop blurs).

## 🏗️ Core Module: The "Infinite Speed" POS (Worker View)
Reproduce the Sanifere "Facture" flow with modern enhancements:
- **The Grid**: A high-density data table that occupies 70% of the screen.
    - Columns: Photo (Small Avatar), Designation, SKU, Price, Qty (with +/- stepper), Discount, Total.
    - **Real-time Context**: When a row is focused, show a small side-panel with the product's "Remaining Stock" and "Last Sale Price" for that specific client.
- **Search**: A global command bar (`Cmd+K`) style search that instantly filters products by name or SKU.
- **Keyboard Mastery**: Every action must have a shortcut (e.g., `F2` to scan, `F4` for payment, `Enter` to add line).

## 📊 Core Module: The "Master Insights" Dashboard
- **Profit Analytics**: Vibrant area charts showing profit *per product family* over time.
- **Stock Heatmap**: A visual grid showing which shelves (Surface vs. Magasin) are running low.
- **Cash Reconciliation**: A beautiful "Billetage" component where the master clicks coins/bills images to count the drawer, with an animated totalizer.

## 🛠️ Technical Constraints (for AI Understanding)
- **Hardware Integration**: The app uses the **OBZ RF-70 Barcode Scanner** for product entry. It functions via HID (keyboard emulation). The UI must handle fast sequential scans optimally.
- **Density**: Do not use massive whitespace. The user needs to see 15+ invoice lines without scrolling.

- **Architecture**:
    - Frontend: React + Tailwind + Vite.
    - Logic: Use the `TeamService` and `POSService` patterns.
    - Offline-Ready: Maintain state in a local store (Zustand) so the worker doesn't lose data if the network blips.

## 📝 The Prompt to Paste into Lovable:
"""
Build a premium, high-density Retail Management Dashboard and POS system. 
Aesthetic: Dark-mode glassmorphism with vibrant teal and amber accents. 
Key Screen 1: "Strategic POS". A high-density grid for sales. Must support rapid keyboard entry. Include a sidebar showing real-time stock for the selected row. Use F-key shortcuts (F2: Pay, F4: Clear).
Key Screen 2: "Global Inventory". Table with multi-level categories (Family > Category > Product). Use color-coding for stock levels (Green: OK, Red: Rupture).
Key Screen 3: "Master Analytics". Use Recharts for profit-per-product visualizations.
Ensure the UI feels alive with micro-animations and smooth transitions. Use Shadcn/ui components but skin them to look like a high-end financial terminal.
"""
