# Dibidani on-prem login failure after update

## Terminology
The environment in question — the app running on hardware physically at the
client's location — is an **on-premise ("on-prem") deployment**, also called
a **desktop/client installation**. In this codebase it's the **"local-bridge"
mode** (Tauri desktop app + local SQLite backend), as opposed to **"Cloud"
mode** (web app talking directly to Supabase). "Dibidani" is the client name,
not the environment type.

## Problem
After installing an update on Dibidani's on-prem machine, local logins stop
working, even though the equivalent Supabase config has been set/confirmed.
The app "just won't connect."

## Findings (2026-07-15, Djati-stores repo)
- `feat/stihl-dibidani` does **not** include commit `9df6847` ("fix(auth):
  session persistence, master password check, password change") from
  Djati-stores `main`. That commit fixed: session not persisting for store
  owners without a `user_roles` row, master-password verification always
  failing in Cloud mode, and a broken password-change flow. If the update
  installed on Dibidani's machine predates this fix, login/session symptoms
  matching the report are expected.
- This branch has its own recent history of Supabase **project-ID typos**
  (`4b9fe80 fix(dibidani): correct Supabase project-ID typo in AIService
  fallback`, plus an earlier `x`→`y` project-ID typo fix referenced in prior
  session notes). "Configured the same on Supabase" doesn't help if the
  installed build is silently pointed at the wrong Supabase project — worth
  confirming which project ID the installed build's `FALLBACK_SUPABASE_URL`
  / env actually resolves to, versus the project actually configured today.
- This branch already has `159a3108`-adjacent commit `159af1e "fix(jwt):
  resolve 3 token bugs that silently prevent login and session restore"` —
  so JWT/session-restore has been a recurring problem area on this branch
  specifically, not a one-off.

## Suggested on-site diagnostic steps
1. Confirm the installed build's version/commit against `feat/stihl-dibidani`
   HEAD — an update that didn't actually include `9df6847` would explain this
   exactly.
2. Check which Supabase project URL the installed build is actually calling
   (network tab / local-bridge logs), not just which project is configured in
   the Supabase dashboard — rule out a stale/typo'd project ID baked into the
   build.
3. Confirm the local-bridge sidecar process is actually running and reachable
   on the client machine (local login failures can also be a local-bridge
   connectivity issue, not a Supabase one).

## How to bring context to the client machine
Copying this chat transcript isn't the right mechanism — Claude Code
transcripts are local files tied to this machine/session, with no supported
export/import flow. Instead: `git pull` the `retail-manager` repo on the
client machine and start a fresh Claude Code session there, pointed at
`memory-bank/core/activeContext.md` (and this file) — that's what the
memory-bank is for, and it already has today's auth-fix history.
