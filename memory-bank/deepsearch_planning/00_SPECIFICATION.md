# DeepSearch Audit Specification

## 1. Objective
To leverage OpenAI's reasoning model (DeepSearch/o1) to perform a "10x Developer" level audit of the existing `retail-manager` codebase. The goal is to obtain specific, actionable technical improvements, focusing on performance on low-end hardware, code solidity, and security.

## 2. Target Persona for AI
- **Role**: Senior Full Stack Developer & DevOps Engineer (20+ Years Experience).
- **Specialization**: High-performance retail POS systems, hybrid offline-first architectures.
- **Background Knowledge**: Extensive user research with 4+ Store Owners and 50+ Store Tellers.
- **Mindset**: Pragmatic, optimization-focused, security-first.

## 3. Key Constraints & Context
- **Hardware Constraint**: The application MUST run smoothly on **Intel Dual Core CPUs with 2.5GB RAM** (Windows 10). This is a non-negotiable hard constraint.
- **Architecture**:
  - **Frontend**: React, Vite, Electron (Offline First).
  - **Local Backend**: Node.js "LocalBridge" with SQLite.
  - **Cloud Backend**: Supabase (Postgres).
- **Current Phase**: Moving from "Template/MVP" to "Production-Hardened".

## 4. Areas for Analysis
1.  **Code Logic & Coherence**:
    - Ensure Frontend and Backend logic are tightly synchronized.
    - Identify logic gaps in the current "Offline-First" implementation.
2.  **Hardware Optimization**:
    - React rendering performance (virtualization, memoization) for 2.5GB RAM.
    - SQLite query efficiency.
    - Electron process management (main/renderer communication).
3.  **Security**:
    - Local data encryption.
    - Role-Based Access Control (RBAC) integrity between Offline/Online states.
4.  **Feature Reality Check**:
    - Identify "Placeholder/Template" features that need to be replaced with functional logic.

## 5. Expected Output from DeepSearch
A comprehensive technical report containing:
- **Critical Refactoring List**: Code blocks that are dangerous or inefficient.
- **Performance Plan**: Specific changes to support the Dual Core/2.5GB requirement.
- **Security Audit**: Vulnerabilities in the local-first approach.
- **Implementation Roadmap**: Step-by-step plan to harden the "already implemented" features.
