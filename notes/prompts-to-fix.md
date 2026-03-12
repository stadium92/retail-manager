## Objective
Update all **worker-side sales (ventes)** flows and UI to match the Sanifère screenshots and align the business logic with pricing rules.

## Scope (Worker side)
- **Vente au Détail** (retail sale)
- **Facturation au Détail** (retail invoice)
- **Facturation en Gros** (wholesale invoice)
- **Facture Proforma**
- **Règlements des Bons** (complete remaining features to match requirements)

## UI reference (must match)
Use these screenshots as the source of truth for layout, sections, and wording:
- [Pro/retail-manager/notes/sanifere-screenshots/vente-detail.jpeg](Pro/retail-manager/notes/sanifere-screenshots/vente-detail.jpeg)
- [Pro/retail-manager/notes/sanifere-screenshots/facture-detail.jpeg](Pro/retail-manager/notes/sanifere-screenshots/facture-detail.jpeg)
- [Pro/retail-manager/notes/sanifere-screenshots/facture-gros.jpeg](Pro/retail-manager/notes/sanifere-screenshots/facture-gros.jpeg)
- [Pro/retail-manager/notes/sanifere-screenshots/proforma.jpeg](Pro/retail-manager/notes/sanifere-screenshots/proforma.jpeg)

**Important:**
- The retail vs wholesale screens are different. Keep those differences.
- Respect every field, label, and section visible in the screenshots.
- Make UI improvements only if they preserve the visual structure and intent.

## Business logic requirements
Think deeply about the **pricing model** and **document type logic**. Implement the correct backend calculations and ensure the UI reflects them.

### Pricing logic (core)
- Define how prices are chosen based on:
	- retail vs wholesale
	- product price fields (see “Fiche produit”)
	- tax/discount rules (HT/TTC where applicable)
- Ensure line totals, taxes, discounts, and grand totals are correct and consistent across all sales documents.

### Document logic (core)
- **Vente au Détail**: cash sale / immediate payment workflow.
- **Facture Proforma**: non-final invoice that reserves prices without stock finalization (confirm logic).
- **Facturation au Détail**: invoice flow for retail customers.
- **Facturation en Gros**: invoice flow for wholesale customers.
- **Règlements des Bons**: complete remaining requirements for payment of order slips.

## Fiche produit (pricing fields)
Review [Pro/retail-manager/notes/sanifere-screenshots/fiche.jpeg](Pro/retail-manager/notes/sanifere-screenshots/fiche.jpeg) and the UI under **Fichiers → Fiche produit → Nouveau produit**.

Clarify and implement correct meanings for these fields:
- **Prix RVT**
- **PVG HT**

If abbreviations are unclear, infer them from context and existing data usage, then align pricing logic and UI accordingly.

## Deliverables
- UI updates that exactly match the screenshots.
- Correct pricing logic for each document type.
- Completed **Règlements des Bons** functionality.
- Any necessary backend logic changes documented and implemented.

