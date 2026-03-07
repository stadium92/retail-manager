# 📊 Retail Manager Memory Bank - Index

## Overview
This index provides navigation for the Retail Manager memory-bank directory, organized by category and function.

---

## 📁 Directory Architecture

```
Pro/retail-manager/memory-bank/
├── INDEX.md (this file)
├── core/                     # Core operations hub
├── tech/                     # Technical setup and build patterns
├── chat/                     # Session logs and chat history
├── planning/                 # Planning and strategy center
├── ai/                       # AI systems and intelligence
├── analysis/                 # Analysis and insights
├── docs/                     # Documentation and resources
│   ├── prd.txt              # Product Requirements Document
│   ├── lovable_frontend_prompt.md  # Frontend generation prompt
│   └── Notes/               # Project notes
└── van-docs/                 # VAN mode documentation
```

---

## 🛠️ Technical Setup & Build Patterns

### Tech Directory Structure
Located in: `tech/`
- **[`tech/windows_arm64_setup.md`](tech/windows_arm64_setup.md)** - Blueprint for rebuilding the development environment on Windows ARM64.
- **[`tech/cross_architecture_build_bible.md`](tech/cross_architecture_build_bible.md)** - **CRITICAL**: The "Bible" for solving the architecture mismatch and library compatibility hell. Essential for builds.
- **[`tech/sidecar_wrapper_strategy.md`](tech/sidecar_wrapper_strategy.md)** - Deep dive into the Rust Wrapper pattern.
- **[`tech/dynamic_port_discovery.md`](tech/dynamic_port_discovery.md)** - Strategy for automated backend port discovery to ensure frontend connectivity across different network environments.
- **[`tech/winreg_security_pattern.md`](tech/winreg_security_pattern.md)** - **SECURITY**: Implementation of Windows Registry mirroring for license and trial timestamps to prevent anti-tampering.

---

## 💬 Session Logs & Chat History

### Chat Directory Structure
Located in: `chat/`
- **[`chat/2026-02-08_sidecar_dependency_resolution.md`](chat/2026-02-08_sidecar_dependency_resolution.md)** - **Problem to Solution (A-Z)**: Comprehensive log of resolving the "Failed to fetch data" issue. Covers missing transitive dependencies (`fastq`), emergency logging implementation, and Tauri resource path corrections.

---

## 🎯 Core Operations Hub

### Core Directory Structure
Located in: `core/`
- Ready for project context, progress tracking, and task management

---

## 🏗️ Planning & Strategy Center

### Planning Directory Structure
Located in: `planning/`
- Ready for implementation plans and strategic documentation

### Plans Directory
Located in: `plans/`
- **[`plans/PRD-004-Smart-Replenishment.md`](plans/PRD-004-Smart-Replenishment.md)** - Smart replenishment / auto-order scheduling PRD
- **[`plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md`](plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md)** - **ACTIVE**: Multi-price tiers (4 selling prices), purchase batch tracking, supplier price integration, batch-level margin analysis. Full DB schema, authorization matrix, frontend specs, and 8-phase implementation plan.

---

## 🤖 AI Systems & Intelligence

### AI Directory Structure
Located in: `ai/`
- Ready for AI capabilities and implementations
- Edge AI integration for sales pattern analysis

---

## 📊 Analysis & Insights

### Analysis Directory Structure
Located in: `analysis/`
- **[`analysis/CLIENT-SERVICE-ANALYSIS-006.md`](analysis/CLIENT-SERVICE-ANALYSIS-006.md)** - **Team audit report**: 11 findings (3 critical, 3 high, 3 medium, 2 low) covering the missing client-service backend, disconnected discount flow, hardcoded client groups, and supplier-vs-client symmetry gap. Includes priority matrix, team Q/A, and 6-phase fix plan.
- **[`analysis/commission-revenue-deep-analysis.md`](analysis/commission-revenue-deep-analysis.md)** - **BUSINESS-CRITICAL**: Full commission cluster analysis. Money leak identification, reseller commission split rules (30% → 15% for royalty holders), Sikasso bulk pricing, pyramid scheme rejection, hidden revenue streams (data entry 15k, training 15k), cumulative 50-sale projection (2.8M FCFA), support model tiers, and Day 1 field report (40% close rate).
- **[`analysis/exit-strategy-time-operations.md`](analysis/exit-strategy-time-operations.md)** - **STRATEGY**: Exit strategy (sell to Orange/Malitel at 200-500 clients), payment gateway as 10x valuation multiplier, acqui-hire model, founder weekly schedule (sales/code/rest split), data entry vs training delegation, and non-negotiable rules for sustainability.

---

## 📚 Documentation & Resources

### Docs Directory Structure
Located in: `docs/`
- **[`PRODUCT_FAMILY_FIX_PRD.md`](PRODUCT_FAMILY_FIX_PRD.md)** - **NEW**: Detailed PRD for fixing product family selection and ensuring proper categorization across Master and Worker interfaces.
- **`prd.txt`** - Product Requirements Document (complete specification)
- **[`docs/PROMPT-005-Multi-Price-Batch-Implementation.md`](docs/PROMPT-005-Multi-Price-Batch-Implementation.md)** - **Agent-ready prompt** for Gemini 3 Pro (1M context). Contains file index, 10x dev persona, raw client Q/A session, and 8 atomic implementation phases (A–H) for PRD-005.
- **[`docs/PROMPT-006-Client-Service-Backend-And-Discount-Fix.md`](docs/PROMPT-006-Client-Service-Backend-And-Discount-Fix.md)** - **Agent-ready prompt** for Gemini 3 Pro (1M context). Fixes 11 client-service bugs: creates `clients` + `client_services` DB tables, backend repos + routes, wires frontend to API, auto-applies client group discounts in POS, adds stock deduction on sale, credit balance tracking, and i18n. 7 phases (0–6).
- **[`docs/PRD-014-Offline-Online-Sync-MVP.md`](docs/PRD-014-Offline-Online-Sync-MVP.md)** - Offline→online hybrid sync execution spec for Mali-ready rollout. Defines outbox/inbox protocol, schema additions, conflict rules, sync endpoints (`/sync/push`, `/sync/pull`), idempotency strategy, 4-week implementation plan, acceptance criteria, and hosting recommendations.
- **[`docs/STAKEHOLDER-OUTREACH-PLAYBOOK-MLI.md`](docs/STAKEHOLDER-OUTREACH-PLAYBOOK-MLI.md)** - Stakeholder map and go-to-market outreach playbook for Mali + sub-region. Includes priority target segments, who to contact first, 30-day pipeline targets, French interview script (15 questions), and first-contact message templates.
- **[`docs/CLIENT-BRIEF-005-Multi-Price-Raw.md`](docs/CLIENT-BRIEF-005-Multi-Price-Raw.md)** - Original unedited client brief for PRD-005. Raw requirements verbatim.
- **[`docs/CLIENT-BRIEF-006-Client-Service-Raw.md`](docs/CLIENT-BRIEF-006-Client-Service-Raw.md)** - Original unedited team brief for ANALYSIS-006. Raw client voice defining team roles (analysts, QA, clients, beta testers) and requesting deep analysis of client-service vs supplier asymmetry, discount flow, and sale integrity.
- **`lovable_frontend_prompt.md`** - Frontend generation prompt for Lovable.dev (complete, all phases)
- **`lovable_frontend_prompt_phase1.md`** - Phase 1: Core Foundation & Master Interface
- **`lovable_frontend_prompt_phase2.md`** - Phase 2: Worker, Deliverer & Customer Interfaces
- **`lovable_frontend_prompt_phase3.md`** - Phase 3: AI Features & Advanced Analytics
- **`interface_architecture_privileges.md`** - Interface architecture, privilege system, and access control design
- **`four_sided_architecture.md`** - Four-sided architecture: Master, Worker, Deliverer, Customer interfaces
- **`feature_brainstorming.md`** - Deep feature brainstorming and analysis for each user type
- **`offline_hybrid_refactor_prd.md`** - Offline-first + hybrid deployment PRD outlining dual data-plane strategy
- **`offline_hybrid_refactor_plan.md`** - Execution plan with phased roadmap and checkbox subtask tracker
- **`Notes/`** - Project notes and documentation

#### Key Files
- **[`docs/prd.txt`](docs/prd.txt)** - Complete PRD with technical architecture, roadmap, and requirements
- **[`docs/CI_CD_PIPELINE.md`](docs/CI_CD_PIPELINE.md)** - **NEW**: Detailed documentation for the automated GitHub Actions CI/CD pipeline and sidecar build process.`r`n- **[`docs/lovable_frontend_prompt.md`](docs/lovable_frontend_prompt.md)** - Comprehensive prompt for generating frontend with four separate interfaces (Master, Worker, Deliverer, Customer). Includes design brainstorming framework and feature requirements. **Complete version with all phases.**
- **[`docs/lovable_frontend_prompt_phase1.md`](docs/lovable_frontend_prompt_phase1.md)** - **Phase 1**: Core Foundation & Master Interface - Authentication, Master dashboard, Sales, Inventory, Workers, Stores, Basic Analytics
- **[`docs/lovable_frontend_prompt_phase2.md`](docs/lovable_frontend_prompt_phase2.md)** - **Phase 2**: Worker, Deliverer & Customer Interfaces - Worker sales entry, Deliverer delivery management, Customer product browsing, Offline support
- **[`docs/lovable_frontend_prompt_phase3.md`](docs/lovable_frontend_prompt_phase3.md)** - **Phase 3**: AI Features & Advanced Analytics - Conversational AI, AI Suggestions, Predictive Analytics, Automated Alerts, Pattern Analysis
- **[`docs/interface_architecture_privileges.md`](docs/interface_architecture_privileges.md)** - Detailed interface architecture, privilege matrix, access control, and design differences
- **[`docs/four_sided_architecture.md`](docs/four_sided_architecture.md)** - Complete four-sided architecture specification: roles, privileges, data flow, and interactions
- **[`docs/feature_brainstorming.md`](docs/feature_brainstorming.md)** - Deep feature brainstorming framework: comprehensive analysis of features needed for each user type (Master, Worker, Deliverer, Customer) with context analysis and prioritization

---

## 🚀 VAN Mode Documentation

### VAN Docs Directory Structure
Located in: `van-docs/`
- Ready for VAN assessments and optimization reports

---

## 📊 Project Summary

**Project Name**: Retail Manager
**Type**: Retail Management & Digital Logistics Platform
**Key Features**:
- Four-sided architecture: Master, Worker, Deliverer, Customer interfaces
- Sales tracking and analytics
- Delivery logistics and GPS tracking
- AI-powered sales suggestions
- Multi-store management
- Real-time monitoring
- Product browsing and ordering (Customer interface)

**Tech Stack**:
- Frontend: React (via Lovable.dev)
- Backend: Local development (Node.js/Python)
- Database: Supabase (PostgreSQL)
- AI: Edge AI for sales pattern analysis

---

## 🌿 Branching Strategy (Phase 6+)
To ensure stability and prevent regressions, use the following branch pattern:
- **`main-cloud-build`**: Source of truth for stable releases.
- **`fix/stock-modules-data`**: Data fetching and sync issues in Stock submodules.
- **`fix/search-and-suppliers`**: Search UI, barcode scanning, and supplier access.
- **`fix/extended-unit-scaling`**: Logic for Paquet/Sac/Box and price conversion.
- **`fix/analytics-and-logs`**: Dashboard charts, Audit Logs, and UI enhancements.
- **`security/DeLorean`**: Dedicated for clock-tamper and license protections.

## 📜 Key PRDs (Phase 6+)
- **[`CLAUDE_ULTIMATE_STABILIZATION_PROMPT.md`](CLAUDE_ULTIMATE_STABILIZATION_PROMPT.md)** - **ULTIMATE**: Comprehensive prompt for total system stabilization, security hardening (Heartbeat/Interceptors), and schema consistency across the entire codebase.
- **[`PRD-006-LocalBridge-Consolidation.md`](PRD-006-LocalBridge-Consolidation.md)** - **NEW**: Architecture Roadmap and strategy for stabilizing the LocalBridge backend with ACID transactions and frontend idempotency after the Supabase removal.
- **[`docs/PRD-008-Comprehensive-Fixes.md`](docs/PRD-008-Comprehensive-Fixes.md)** - **CONSOLIDATED**: Master list of bugs and feature requests categorized for Phase 6+ development.


## 🔍 Quick Access Guide

| Need | Go To | Primary File |
|------|-------|--------------|
| **ARM64 Setup Guide** | `tech/` | `windows_arm64_setup.md` |
| **PRD Document** | `docs/` | `prd.txt` |
| **Frontend Prompt (Complete)** | `docs/` | `lovable_frontend_prompt.md` |
| **Frontend Prompt - Phase 1** | `docs/` | `lovable_frontend_prompt_phase1.md` |
| **Frontend Prompt - Phase 2** | `docs/` | `lovable_frontend_prompt_phase2.md` |
| **Frontend Prompt - Phase 3** | `docs/` | `lovable_frontend_prompt_phase3.md` |
| **Interface Architecture & Privileges** | `docs/` | `interface_architecture_privileges.md` |
| **Four-Sided Architecture** | `docs/` | `four_sided_architecture.md` |
| **Feature Brainstorming** | `docs/` | `feature_brainstorming.md` |
| **Offline/Hybrid PRD** | `docs/` | `offline_hybrid_refactor_prd.md` |
| **Offline/Hybrid Plan** | `docs/` | `offline_hybrid_refactor_plan.md` |
| **Core Operations** | `core/` | Future core files |
| **Planning** | `planning/` | Future planning docs |
| **AI Features** | `ai/` | Future AI implementations |
| **Analysis** | `analysis/` | Future research data |
| **Documentation** | `docs/` | `prd.txt` |
| **VAN Mode** | `van-docs/` | Future VAN docs |

---

## 📈 Key Features

### Retail Manager Focus
- **Multi-Store Management** - Store owners can manage multiple locations
- **Role-Based Access** - Distinct interfaces for Masters and Workers
- **Sales Analytics** - Comprehensive tracking and reporting
- **AI Intelligence** - Edge AI provides sales optimization suggestions
- **Real-time Updates** - Live synchronization across devices

### Current Implementation Status
- **Planning Phase** - PRD complete, ready for MVP development
- **Frontend Ready** - Lovable.dev prompt prepared for generation
- **Backend Planning** - Local development with Supabase integration

---

## 📝 Index Maintenance

**Last Updated**: Split Lovable.dev prompt into 3 phases for incremental development
**Total Files Indexed**: 8 files (PRD + Frontend Prompt Complete + 3 Phase Prompts + Interface Architecture + Four-Sided Architecture + Feature Brainstorming)
**Categories**: 6 main functional categories
**Status**: Memory bank initialized, ready for development

### Update Protocol
1. Add new files to appropriate directory
2. Update this index when new directories/files are added
3. Maintain functional grouping logic
4. Ensure navigation links remain functional

---

*This memory bank provides the foundation for the Retail Manager project. The PRD document contains all specifications needed for MVP development.*

