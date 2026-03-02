# Prompt: Fix "Rigid Zero" UX in Numeric Inputs (Standalone)

You are working in the Retail Manager codebase.

## Objective
Fix the UX bug where numeric input fields become "locked" at `0`, making it hard for users to clear and type a new value naturally.

This prompt is **strictly for input UX behavior** and must **not** include any security, licensing, activation, or unrelated refactoring tasks.

## Problem Description
In some forms (especially quantity/price/discount fields), inputs default to `0` and immediately coerce empty input back to zero. This causes a bad typing flow:
- User selects the field.
- User presses backspace/delete.
- Field instantly returns to `0`.
- User must fight the control to enter a value.

## Required Behavior
Implement a controlled-input pattern that supports temporary empty state while editing:

1. Inputs can be empty string (`""`) during typing.
2. Numeric parsing happens safely:
	- During `onChange`, keep raw string state.
	- Convert to number only when needed (blur/save/submit).
3. On `onBlur`:
	- If empty, apply sensible default (`0` where business rules require it).
	- If invalid, normalize gracefully.
4. Do not break existing calculations, totals, validations, or persistence.
5. Keep TypeScript types explicit and safe.

## Scope
Apply this fix only to affected numeric form inputs (e.g. quantity, unit price, discount, stock, etc.) in the relevant sales/product dialogs.

## Implementation Guidance
- Use `string | number` or a dedicated string UI state for form fields.
- Avoid forcing `Number(value)` on every keystroke.
- Add helper functions for parse/normalize to keep components clean.
- Keep changes minimal and localized.

## Acceptance Criteria
- User can clear `0` and type naturally without cursor fighting.
- Empty interim state is allowed while editing.
- Final stored values remain valid numbers.
- No regression in total calculations or submit behavior.
- TypeScript build remains clean.

## Deliverables
1. Updated components with fixed input behavior.
2. Brief summary of files changed and why.
3. Quick verification steps (manual test cases) showing the bug is resolved.

## Non-Goals
- No security/auth/license changes.
- No large architecture rewrite.
- No unrelated UI redesign.

