# Lumina Pages

A **local-first anti-detect platform** for creating, warming, and running multiple
social media accounts at scale. Each account is a **Profile** — one identity pinned
to a fingerprint + a dedicated proxy + a persistent browser session — that you launch,
manage, and (later) automate, all from one local dashboard.

Built to replace laggy remote-desktop phone farms: everything runs locally (instant,
responsive), coordinated centrally.

## Status — Phase 1: Core Engine

- [x] Profile management (create / edit / delete) — SQLite (`data/lumina.db`)
- [x] Fingerprint presets (coherent UA + locale + timezone bundles)
- [x] Per-profile proxy binding
- [x] Per-profile persistent browser session (`data/.profiles/<id>/chromium`)
- [x] Stealth launch (playwright-extra + stealth) with a **hard egress-IP guard**
      (a proxied profile aborts if it would expose your home IP)
- [x] Local web dashboard (Next.js) — launch / stop / status

**Next phases:** ② shared cloud DB + team layer · ③ warm-up automation + humanization
core · ④ posting + scheduling + content library · ⑤ analytics.

## Architecture

- **Next.js app** = dashboard + API + SQLite store (one `npm run dev`).
- **Runner** (`lib/engine/runner.mjs`) = a child process spawned per launch that owns
  one profile's headed stealth browser. Decoupling the browser from the web server
  keeps sessions alive across dashboard reloads. Closing the window ends the runner,
  which flips the profile back to `idle`.

## Run

```bash
npm install          # installs deps + downloads Chromium (postinstall)
npm run dev          # http://localhost:3000
```

`data/` (SQLite DB, proxy creds, account sessions, per-profile browser dirs) is
**gitignored** and never leaves the machine.
