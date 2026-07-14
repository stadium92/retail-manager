# Product Context - Retail Manager

*Last updated: 2026-07-13*
*New canonical core file (no prior version existed).*

## Why This Product Exists
Small retailers in Mali and the sub-region lose a large share of revenue (up to ~20%) to employee
theft, stock shrinkage, and untracked cash. Existing POS/ERP tools assume constant internet, modern
hardware, and monthly subscriptions — none of which match the local reality. Retail Manager exists to
give these owners **verifiable control** over stock and cash while running fully offline on cheap
hardware, sold once rather than rented.

## Problems It Solves
1. **Theft & shrinkage** — blind closeouts, immutable audit logs, and role-based permissions mean a
   cashier cannot delete sales, edit stock, or hide discrepancies.
2. **No connectivity** — the local SQLite plane is the source of truth; the store never stops selling
   because the internet is down.
3. **Multi-store blindness** — an owner with several shops gets a "hub and spoke" consolidated view
   once devices sync to the cloud.
4. **Subscription fatigue** — one-time perpetual license, optional cheap yearly cloud add-on.
5. **Language & literacy** — full i18n in French (fr), English (en), and Bambara (bm); retro-DOS-style
   keyboard-first POS for fast, low-friction data entry.

## Who Uses It (Four-Sided Model)
- **Master (Owner)** — full visibility across stores: inventory, valuation, purchasing, suppliers,
  clients, team, audit logs, licensing. Sees everything a Worker registers.
- **Worker (Cashier/Clerk)** — bound to one store; runs the POS (retail, wholesale, proforma),
  receives goods, manages files (clients/suppliers/products) with restricted permissions.
- **Deliverer** — delivery/logistics management (GPS tracking planned).
- **Customer** — product browsing / ordering surface (lightest interface).

## How It Should Feel
- **Instant** — FTS5 search, windowed queries, thin React client; snappy even on 2.5 GB RAM.
- **Keyboard-first** — F1–F12 shortcuts mirror legacy POS terminals; F1 opens a high-contrast
  retro-DOS help overlay.
- **Trustworthy** — every consequential action is logged; permissions are strict by default.
- **Localized** — currency (XOF/GHS/EUR/USD), language, and denominations adapt to the store.

## Monetization
- **Primary**: one-time perpetual license with an activation-key system (trial nag screens, store-count
  enforcement, brute-force lockout).
- **Optional**: low-cost yearly cloud-sync add-on for multi-store backup and remote continuity.
- **Client-branded builds**: dedicated branches produce branded deployments for specific dealers
  (e.g. STIHL dealers — Dibidani, Niamakoro, Centenary; Niamanan Dubai).
