# Retail Manager Improvements (Inspiration from Sanifere)

Based on the analysis of Sanifere, here are high-impact features and improvements we should integrate into the Retail Manager app.

## 🚀 High Priority (Immediate Value)

### 1. Advanced Product Card Insights
- **Feature**: Add "Quick History" to the Product detail/edit view.
- **Details**: Display "Last Sale Date", "Last Restock Date", and "Most Frequent Supplier" directly on the main info card.
- **Sani-Inspiration**: Found in the `Fiche Produit` view.

### 2. Denomination-Based Cash Tally
- **Feature**: Update the Close Register workflow to include a bill/coin counter.
- **Details**: Instead of just entering "Total Cash", provide inputs for 10k, 5k, 2k, etc. (CFA specific). Automatically sum the total.
- **Sani-Inspiration**: Found in the `Fiche Caisse` screen.

### 3. Integrated Stock Visibility during Sales
- **Feature**: In the Worker's Sale Entry screen, show the "Remaining Stock" for the selected item in a clear badge or column.
- **Details**: This prevents workers from attempting to sell more than is physically present without leaving the POS screen.
- **Sani-Inspiration**: Standard feature in Sanifere `Facture Detail`.

## 📈 Medium Priority (System Optimization)

### 1. Automated Order Suggestions
- **Feature**: Create a "Restock Recommendation" report.
- **Details**: Analyze items below `Stock Mini` and suggest order quantities based on past consumption.
- **Sani-Inspiration**: `Commande AUTOMATIQUE` module.

### 2. Multi-Level Pricing Support
- **Feature**: Allow products to have "Wholesale" vs "Retail" pricing tiers.
- **Details**: Ensure the POS can toggle between `Vente au DETAIL` and `Vente en GROS` modes, applying the correct price automatically.
- **Sani-Inspiration**: `Facture Gros` vs `Facture Detail` screens.

### 3. Loss/Spoilage explicitly tracked
- **Feature**: Add a "Record Loss" button to inventory management.
- **Details**: Track items removed from stock due to damage or expiration separately from sales.
- **Sani-Inspiration**: `SORTIE des PERTES` module.

## 🎨 UI/UX Enhancements

### 1. Keyboard Mastery
- **Enhancement**: Implement more global keyboard shortcuts (e.g., `F2` to Search, `F10` to Print).
- **Details**: Focus on "No-Mouse" readiness for high-volume sales environments.

### 2. High-Density Tables
- **Enhancement**: Create a "Compact View" for product tables that shows more rows on a single screen without sacrificing critical info (Stock, Price).
