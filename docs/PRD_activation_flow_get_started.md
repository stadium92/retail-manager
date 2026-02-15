# PRD: Activation Gate Skip Flow and Banner Behavior

## Summary
Users who click "Continue with Trial Version" should land on the Get Started page without the license banner obscuring the UI. The current behavior shows the banner immediately after redirect, making the Get Started page unusable.

## Background
- The app uses a license gate for activation with a trial option.
- When a user skips activation, the app should allow navigation to the Get Started page.
- A persistent banner currently appears even after skipping, blocking the page.

## Problem Statement
When a user selects "Continue with Trial Version", they are redirected to the Get Started page, but the license banner reappears and covers the content. This defeats the purpose of the trial skip and creates a broken first-time experience.

## Goals
- After skipping activation, the user reaches the Get Started page.
- The license banner should not appear during the same session after skipping.
- The behavior should be consistent in web dev mode and in the packaged app.

## Non-Goals
- Redesigning the activation UI.
- Changing the activation key logic or license validation.
- Removing the activation gate entirely.

## User Stories
1. As a new user, I can skip activation and see the Get Started page without obstructions.
2. As a trial user, I can continue using the app without repeated activation prompts during the same session.

## Functional Requirements
1. When user clicks "Continue with Trial Version":
   - Redirect to the Get Started page (route: "/").
   - Suppress the license banner for the remainder of the session.
2. On app refresh in the same session, the banner remains hidden.
3. On new session, the banner can appear again if the license is still trial/expired.

## UX Requirements
- The Get Started page remains fully visible and interactive after skipping.
- No modal or banner overlays block content after skip in the same session.

## Acceptance Criteria
- Clicking "Continue with Trial Version" always lands on "/".
- No license banner appears after skipping in the same session.
- A fresh session can show the banner again if license is not active.

## Risks / Edge Cases
- The skip flag might not be set if localStorage/sessionStorage is disabled.
- The banner may still appear if skip state is not read before rendering.

## Implementation Plan
1. Track a session-level "trial skipped" flag.
2. On skip:
   - Set the flag in sessionStorage.
   - Update in-memory state to hide banner immediately.
   - Redirect to the Get Started page.
3. When rendering the banner:
   - Only show if license is not active AND trial skip flag is false.

## Test Plan
- Start app fresh with trial status.
- Click "Continue with Trial Version".
- Verify redirect to "/".
- Confirm no banner overlays the Get Started page.
- Refresh the page in same session and confirm banner stays hidden.
- Open a new session and confirm banner can reappear.

## Gemini Prompt
"""
You are helping improve a Tauri + React app license activation flow. The current issue is: after clicking "Continue with Trial Version" in the activation gate, the user is redirected to the Get Started page but the license banner appears and blocks the UI.

Requirements:
- After skip, redirect to "/" (Get Started page).
- Suppress the license banner for the remainder of the session.
- On a new session, banner can appear again if license is trial/expired.

Please propose code changes in the license context to:
1) Set a session-level skip flag when skipping.
2) Use that flag to hide the banner in the same session.
3) Ensure the redirect happens immediately after skip.

Provide concise code updates and explain any new state or storage keys.
"""
