# Lumina Pages — Developer Handoff

This document is for an engineer/agent picking up development. It explains what the app is,
what's built, how it's structured, the key decisions (and *why*), how to run it, what to build
next, and the non-obvious gotchas. Read it fully before changing code.

---

## 1. What this is

A **local-first app for creating, warming, and running many social media accounts at scale** —
Instagram, Facebook, TikTok, X, YouTube. It replaces a failed "phone farm" (physical phones in
another country, driven over laggy AnyDesk/UltraViewer). Instead, each operator runs the app on
their **own computer**; a shared database keeps a team in sync.

The unit of the app is a **Profile** = one account identity = **{ fingerprint + a bound proxy +
a persistent browser session + saved per-platform cookies }**. You create a profile, launch it
(a real stealthed Chromium opens on that profile's proxy + fingerprint), log in / warm / post,
and its session persists for next time.

**Proven premise:** a single burner IG account run this way (consistent residential IP + stealth
browser, human behaviour) survived weeks of daily use with no ban. This app productizes that.

---

## 2. Current status — Phase 1 (Core Engine) is DONE and working

Verified end-to-end (create → launch → egress-IP guard → stealth browser → stop, no orphaned
processes; edit; import session cookies → launches logged in).

Working today:
- Profile CRUD (create / edit / delete), stored in SQLite.
- Fingerprint presets (coherent UA + locale + timezone bundles).
- Per-profile proxy binding.
- Per-profile **persistent** browser session (`data/.profiles/<id>/chromium`).
- **Stealth launch** via a spawned child process, with a **hard egress-IP guard** (a proxied
  profile aborts before touching the platform if the egress IP is not the proxy — so an account
  is never exposed on the operator's home IP).
- **Launch platform picker** — a profile can hold logins for several platforms; you choose which
  to open at launch.
- **Per-platform session cookie import** — paste a warmed account's cookies (a `{name: value}`
  map or a cookie array) so the profile launches already logged in.
- Local web dashboard (Next.js) — live status, launch/stop/delete/edit, sessions.

**Not built yet:** everything in the sidebar marked "SOON" (Warm-up, Posting, Content, Schedule,
Analytics, Proxies) and the shared cloud DB / team layer. See §9 Roadmap.

---

## 3. Quickstart

```bash
cd lumina-pages
npm install          # installs deps + downloads Chromium (postinstall)
npm run dev          # http://localhost:3000
```

Requirements: **Node 24+** (uses the built-in `node:sqlite`). `data/` is created on first run and
is **gitignored** (it holds the SQLite DB, proxy credentials, account sessions, and per-profile
browser dirs — never commit it).

To test a launch you need a working proxy. Create a profile with a proxy (`http://host:port` +
user/pass), click Launch, and confirm the runner logs `egress IP = <proxy ip>` before it opens
the platform.

---

## 4. Tech stack + key decisions (and WHY)

| Choice | Why |
| --- | --- |
| **Next.js 14 (app router)** | One process = dashboard + API. Matches the wider team's stack. Route handlers run in Node (`export const runtime = "nodejs"`). |
| **`node:sqlite`** (Node's built-in), NOT `better-sqlite3` | `better-sqlite3` has **no prebuilt binary for Node 24** and fails to compile (no MSVC). `node:sqlite` is built in, same synchronous API (`prepare/get/all/run`, `@named` params, `lastInsertRowid`). Emits a harmless `ExperimentalWarning`. |
| **`playwright-extra` + `puppeteer-extra-plugin-stealth`** | Anti-detection: hides `webdriver`, patches automation tells. `--disable-blink-features=AutomationControlled` on launch. |
| **Spawned child-process "runner"** (`lib/engine/runner.mjs`) owns each browser | Decouples browser lifetime from the web server. A dashboard reload / hot-reload doesn't kill open browsers. The runner owns one profile's headed Chromium and exits when the window closes. |
| **PID-based lifecycle via the DB** (not an in-memory Map) | In Next.js **dev**, route handlers can get **separate module instances**, so an in-memory registry populated by `/launch` isn't reliably visible to `/stop`. The runner's OS pid is stored on the profile row and is the single source of truth. Status self-heals from process liveness. |
| **Windows `taskkill /T` to stop** | A plain kill orphans Chromium (it's a child of the runner). `taskkill /PID <pid> /T /F` kills the whole tree. (Non-Windows uses `process.kill`.) |
| **`serverComponentsExternalPackages`** in `next.config.mjs` | Keeps `playwright*` out of the webpack bundle so they run as real Node modules. |

---

## 5. Architecture / request flow

```
Browser (dashboard)  ──HTTP──►  Next.js API routes (Node runtime)
                                   │
                                   ├─ lib/engine/store.ts      (SQLite: profiles CRUD)
                                   ├─ lib/engine/cookies.ts    (per-platform session files)
                                   └─ lib/engine/manager.ts    (spawn/track/stop runners)
                                            │ spawn(node, runner.mjs, config.json)
                                            ▼
                                   lib/engine/runner.mjs  ── owns one headed Chromium
                                     (proxy + fingerprint + persistent user-data-dir
                                      + injected cookies + egress-IP guard)
```

**Launch sequence:** dashboard POSTs `/api/profiles/<id>/launch` with `{platform}` → `manager.launchProfile`
resolves the fingerprint (+ timezone override), collects that platform's cookies
(`cookies.cookiesForLaunch`), writes `data/.profiles/<id>/launch-config.json`, spawns
`runner.mjs <configPath>`, records `pid` + `status=running` on the profile. The runner opens a
**persistent** context (so the session is saved), injects cookies, **asserts egress IP == proxy**,
then navigates to the chosen platform and stays open until the window closes. On exit the manager
flips the profile back to `idle` (and `isRunning` self-heals from pid liveness regardless).

---

## 6. File-by-file map

**Engine (`lib/engine/`)**
- `store.ts` — SQLite profile store. `Profile` type + CRUD (`listProfiles`, `getProfile`,
  `createProfile`, `updateProfile` [partial, skips `undefined`], `deleteProfile`). DB at
  `data/lumina.db`. `profileDir(id)` → `data/.profiles/<id>`.
- `fingerprints.ts` — `FINGERPRINTS` presets (`us-win`, `us-mac`, `mx-win`, `gb-win`), each a
  coherent { userAgent, viewport, deviceScaleFactor, locale, timezoneId, platform }. **Never mix
  incoherent values** (e.g. es-MX locale on a New York timezone is itself a detection tell).
- `manager.ts` — spawns/tracks/stops runners. PID-based. `launchProfile(id, platformOverride?)`,
  `stopProfile(id)`, `isRunning(id)`, `runningIds()`.
- `runner.mjs` — standalone child process (NOT bundled; plain ESM). Launches the persistent,
  proxied, fingerprinted, stealthed Chromium for one profile + the egress-IP guard + cookie
  injection. This is the productized version of the burner tooling.
- `cookies.ts` — per-profile, per-platform session storage (files under
  `data/.profiles/<id>/cookies/<platform>.json`). `normalizeForPlatform` re-domains a pasted
  `{name:value}` map or cookie array to the platform's cookie domains (IG/FB/TikTok/X[both x.com
  + twitter.com]/YouTube).

**Shared (`lib/`)**
- `platforms.ts` — platform metadata (key, label, brand color) shared across the UI.

**API (`app/api/`)** — all `runtime="nodejs"`, `dynamic="force-dynamic"`
- `profiles/route.ts` — GET (list, with `running` + `sessions`) / POST (create).
- `profiles/[id]/route.ts` — GET / PUT (edit; 409 if running) / DELETE.
- `profiles/[id]/launch/route.ts` — POST `{platform}`.
- `profiles/[id]/stop/route.ts` — POST.
- `profiles/[id]/cookies/route.ts` — GET (which platforms have sessions) / PUT `{platform,cookies}` / DELETE `?platform=`.
- `fingerprints/route.ts` — GET presets.

**UI (`app/` + `components/`)**
- `layout.tsx` — app shell (`<Sidebar/>` + `<main>`).
- `page.tsx` — Profiles page: grid of cards, create/edit/cookies modals, launch/stop/delete,
  polls `/api/profiles` every 3s for live status.
- `globals.css` — the whole design system (dark theme, tokens, cards, modals, popover). No CSS framework.
- `Sidebar.tsx` — nav; "Manage → Profiles" active; automation sections rendered as latent "SOON".
- `ProfileCard.tsx` — one profile: avatar, status pill, meta rows, launch platform picker,
  session dots, edit/cookies/delete.
- `ProfileModal.tsx` — create AND edit (shared).
- `CookiesModal.tsx` — import/clear per-platform sessions.

---

## 7. Data model

`profiles` table (SQLite): `id, name, niche, platform, fingerprint_preset, proxy_server,
proxy_username, proxy_password, timezone_override, notes, status ('idle'|'running'), pid,
created_at, last_used_at`.

Sessions are **files**, not DB rows: `data/.profiles/<id>/cookies/<platform>.json` holds the raw
pasted cookies; `data/.profiles/<id>/chromium/` is the persistent browser profile.

---

## 8. Roadmap — what to build next (in order)

The sidebar already lists these as "SOON". Build them in this order; each builds on the last.

1. **Phase 2 — Team layer / shared DB.** Move the store from local SQLite to a shared cloud
   database (Postgres) so multiple operators see one synced view. Keep the local runner model
   (browsers still run on each person's machine); only the *metadata* is shared. Add basic
   auth/members. Keep proxy creds handling careful.
2. **Phase 3 — Warm-up automation + humanization core.** Automate the manual warming (scroll feed,
   watch, like, follow, dwell). **The humanization core is load-bearing** — randomized delays,
   bezier mouse paths, variable scroll, action-rate caps. A naive loop gets accounts banned faster
   than no automation.
3. **Phase 4 — Posting + scheduling + content library.** This is the point of the product (theme
   pages live on consistent posting). Two ban-critical pieces:
   - **Content library** with **re-encode/dedup** — never post an exact-duplicate media hash
     (Meta/IG detect reposts); track what's posted where.
   - **Human-cadence scheduler** — per-account daily caps, slow ramp for new accounts, jittered
     timing, timezone-aware windows.
4. **Phase 5 — Analytics** — per-account growth/views, best-time-to-post.

---

## 9. Gotchas / lessons (things that will bite you)

- **Node 24 required.** `better-sqlite3` won't compile; we use `node:sqlite` (experimental warning
  is expected and harmless).
- **Dev-mode module instances.** Don't rely on module-level singletons surviving across route
  handlers or hot reloads — that's why lifecycle state lives in the DB (pid), not memory.
- **Stopping a browser on Windows = tree-kill.** Killing only the runner orphans Chromium; use
  `taskkill /T`. If you ever see stray `chrome.exe` with `lumina-pages` in the cmdline, that's an
  orphan — the PID/self-heal logic + tree-kill are there to prevent it.
- **Grid/heavy pages need CSS.** If you add media-blocking to save bandwidth, remember that pages
  needing layout/scroll (e.g. profile grids) break without CSS — override the block per-page.
- **Persistent context saves everything.** Cookies injected at launch get written into the
  `chromium/` dir, so a profile can appear "logged in" from stored state even without an imported
  cookie file. To truly reset, clear both the `cookies/` file and the `chromium/` dir.
- **`data/` is secret.** Proxy creds + live account sessions. Gitignored — keep it that way.
- **Line endings:** repo shows LF→CRLF warnings on Windows; harmless. (Nit: `tsconfig.tsbuildinfo`
  got committed — add it to `.gitignore` when convenient.)

---

## 10. Anti-detection principles (inform every automation feature)

These are *why* the burner survived and must guide Phases 3–4:
- **One consistent IP per account** (static residential), never rotated mid-session. This is the
  single biggest factor. Two accounts can share one IP only if they use **different fingerprints**
  (looks like two devices in a household, not one farm).
- **Coherent, pinned fingerprint** per account (IP geo must match timezone/locale).
- **Behave like a person, act slowly.** Bans are driven by *actions* (mass follow/like, spammy
  posting, high-rate scraping) far more than by passive viewing. Human cadence + volume caps.
- **Views are monotonic** (relevant if you add scraping): never let a re-read lower a stored count.
- **Back off at the first sign of a soft-block / "suspect automated behavior" warning.**

---

## 11. Conventions

- Commits so far are small and scoped (`feat:` / `fix:`), co-authored. Keep that.
- Never commit `data/`, `.env`, or any secret.
- Typecheck before committing: `npx tsc --noEmit`.
- The app is intentionally dependency-light (no CSS framework, no ORM). Prefer that.
