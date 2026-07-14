# Project Brief - Retail Manager

*Last updated: 2026-07-13*
*Canonical core file. Consolidates and supersedes `core/context/projectbrief.md` (kept for history).*

## Core Goal
A comprehensive **offline-first retail management & digital-logistics platform** designed to
digitize and optimize small retail operations through sales analytics, strict inventory control,
and (planned) AI-powered insights. **Crucially, it serves as an Accountability & Anti-Theft
System** to prevent the severe revenue loss (up to ~20%) common in emerging-market retail.

## Key Objectives
- **Strict Accountability & Anti-Theft**: Blind closeouts, strict role-based permissions
  (cashiers cannot delete sales or edit stock), immutable English-only audit logs.
- **Offline-First Hybrid Architecture**: The POS works flawlessly with no internet
  (validated reality: many target stores have no Wi-Fi), then syncs to the cloud (Supabase)
  when available for multi-store "hub and spoke" oversight.
- **Low-End Hardware Compatibility**: Runs on Intel Dual-Core CPUs with ~2.5 GB RAM, including
  32-bit (`i686-pc-windows-msvc`) Windows targets.
- **Four-Sided System**: Distinct interfaces for Master (Owner), Worker, Deliverer, Customer.
- **AI Intelligence (planned)**: "ChatGPT for retail managers" — edge AI analyzing sales and
  inventory patterns once ~1 month of sales data is collected.
- **One-Time Payment Model**: Perpetual license for the offline app, optional low-cost yearly
  add-ons for cloud sync — matching local anti-subscription purchasing preferences.

## Product Surfaces (current monorepo)
- **`retail-manager` (root)** — Tauri v2 desktop shell + `backend/local-bridge` Fastify/SQLite sidecar.
  This is the flagship offline desktop POS.
- **`retail-manager-stores`** (git submodule; internal name `retail-manager`, v0.5.5) — the
  React/Vite frontend consumed by the Tauri shell **and** independently deployable to Vercel as a
  web app (stores / access-control surface).
- **`retail-manager-restaurant`** (git submodule; `restomanager`, v0.5.31) — a restaurant-oriented
  variant sharing the same architecture.

## Target Audience
Small retail store owners, quincailleries (hardware stores, e.g. STIHL dealers), pharmacies, and
independent retailers managing one or several locations, specifically in emerging markets (Mali and
the sub-region) facing high theft rates, low connectivity, and subscription fatigue.

## Success Criteria
- Drastic reduction in inventory shrinkage and employee theft.
- Reliable operation on target low-end hardware without internet.
- Complete, conflict-safe data sync between local and cloud planes for remote monitoring.
- AI activation after ~1 month of sales-data collection.
- High conversion via the one-time-payment pricing model.
