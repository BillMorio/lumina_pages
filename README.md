# Lumina Pages

A **shared, local-first anti-detect platform** for creating, warming, and running multiple
social media accounts at scale. A **Profile** is one IP identity (a fingerprint pinned to a
dedicated proxy); an **Account** is a platform login riding on that profile (username/password/
2FA/cookies) — a profile can hold several accounts (e.g. 3 Instagram logins on one IP), each
launched independently into its own persistent browser session.

Built to replace laggy remote-desktop phone farms: every operator runs the app on their own
machine, launching real local browser windows, while a shared Postgres (Neon) database keeps the
whole team's profiles/accounts/activity in sync.

## Status — Phase 1 + 2: Core Engine + Team Layer

- [x] Profile (IP identity) and Account (platform login) management, capped at 3 accounts per
      platform per profile
- [x] Fingerprint presets (coherent UA + locale + timezone bundles)
- [x] Per-account persistent browser session, launched through its parent profile's proxy
- [x] Stealth launch (playwright-extra + stealth) with a **hard egress-IP guard**
      (aborts if it would expose your home IP)
- [x] **Shared team database (Neon Postgres)** — every operator's machine reads/writes the same
      profiles/accounts; each machine still runs its own local browser windows
- [x] Multi-user login (named operators) + an activity log + a browser-session log (who launched
      what, on which IP, for how long)
- [x] Local web dashboard (Next.js) — launch / stop / status, search, platform tabs

**Next phases:** ③ warm-up automation + humanization core · ④ posting + scheduling + content
library · ⑤ analytics.

## Architecture

- **Next.js app** = dashboard + API (one `npm run dev`); data lives in **Neon Postgres**, shared
  across every operator's machine via `DATABASE_URL`.
- **Runner** (`lib/engine/runner.mjs`) = a child process spawned per launch that owns one
  account's headed stealth browser. Decoupling the browser from the web server keeps sessions
  alive across dashboard reloads. Closing the window ends the runner, which flips the account
  back to `idle`. Each account's browser + cookies are **local files** on whichever machine
  launched it — those don't sync, only the DB metadata does.

## Run

```bash
npm install                 # installs deps + downloads Chromium (postinstall)
cp .env.example .env.local  # then fill in DATABASE_URL
npm run dev                 # http://localhost:3000
```

First person to visit `/login` on a fresh database creates the admin account. Everyone after
that logs in with their own operator account (an admin can add teammates from the same flow).

`data/` (per-account cookies + persistent browser profiles) is **gitignored** and never leaves
the machine it was launched on. `.env.local` (the shared `DATABASE_URL`) is also gitignored —
share it with teammates directly, not through git.
