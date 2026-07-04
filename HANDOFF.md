# Lumina Pages — Developer Handoff

This document is for an engineer/agent picking up development. It explains what the app is,
what's built, how it's structured, the key decisions (and *why*), how to run it, what to build
next, and the non-obvious gotchas. Read it fully before changing code.

---

## 1. What this is

A **shared, local-first app for creating, warming, and running many social media accounts at
scale** — Instagram, Facebook, TikTok, X, YouTube. It replaces a failed "phone farm" (physical
phones in another country, driven over laggy AnyDesk/UltraViewer). Each operator runs the app on
their **own computer** and launches real local browser windows; a shared Postgres database (Neon)
keeps everyone's profiles/accounts/activity in sync.

Two entities:
- **Profile** = one IP identity = **{ fingerprint preset + a bound proxy + timezone }**. This is
  what must stay consistent for anti-ban.
- **Account** = one platform login riding on a profile = **{ username/password/2FA + its own
  cookies + its own isolated persistent browser session }**. A single profile (one IP) can hold
  several accounts — e.g. 3 Instagram logins — each launched independently but always through its
  parent profile's proxy + fingerprint, capped at **3 accounts per platform per profile**.

**Proven premise:** a single burner IG account run this way (consistent residential IP + stealth
browser, human behaviour) survived weeks of daily use with no ban. This app productizes that.

---

## 2. Current status — Phase 1 (Core Engine) + Phase 2 (Team Layer) are DONE

Verified end-to-end (create profile → add account → launch → egress-IP guard → stealth browser →
stop, no orphaned processes; edit; import session cookies → launches logged in; two machines
sharing the same Neon DB see each other's profiles/accounts).

Working today:
- Profile (IP identity) and Account (platform login) CRUD, stored in **Neon Postgres** —
  shared across every operator's machine via `DATABASE_URL`.
- Max **3 accounts per platform per profile** (enforced server-side and in the UI).
- Fingerprint presets (coherent UA + locale + timezone bundles), bound to the profile.
- Per-account **persistent** browser session (`data/.accounts/<id>/chromium`), launched through
  its parent profile's proxy — two accounts on one profile run concurrently without colliding.
- **Stealth launch** via a spawned child process, with a **hard egress-IP guard** (aborts before
  touching the platform if the egress IP isn't the proxy's).
- **Per-account session cookie import** — paste a warmed account's cookies (a `{name: value}` map
  or a cookie array) so it launches already logged in. *Known issue:* the imported snapshot is
  re-injected on **every** launch, which can clobber a session that's since evolved naturally from
  real browsing — worth fixing to only inject on an account's first launch (see §9).
- **Multi-user login** (named operators, scrypt-hashed passwords, hashed session tokens) — the
  first person to register becomes admin; admins can add teammates.
- **Activity log + browser-session log** — every create/edit/delete/launch/stop/cookie-import is
  attributed to whoever did it; browser sessions show who launched what, on which profile/IP, and
  for how long (paired from `account.launch`/`account.stop` activity rows).
- **Host-aware run-state tracking** — since the DB is shared across machines, a `pid` alone isn't
  enough (pid 4821 means nothing on a machine that didn't spawn it). Each launch stamps `host`
  (the machine's hostname); a mismatch means "running elsewhere" — trusted from the DB rather than
  probed locally, and stop requests from the wrong machine are refused.
- Local web dashboard (Next.js) — profile clusters with per-platform account groups, platform
  tabs, search, live status, launch/stop/edit/delete.

**Not built yet:** everything in the sidebar marked "SOON" (Warm-up, Posting, Content, Schedule,
Analytics, Proxies). See §8 Roadmap.

---

## 3. Quickstart

```bash
cd lumina-pages
npm install                 # installs deps + downloads Chromium (postinstall)
cp .env.example .env.local  # fill in DATABASE_URL (a Neon Postgres connection string)
npm run dev                 # http://localhost:3000, pinned via package.json
```

No specific Node version is required anymore (the earlier Node 24 requirement was for
`node:sqlite`, which is gone now that the store is Postgres — any reasonably current Node LTS
works). `data/` is created on first run and is **gitignored** (it holds each account's cookies and
persistent browser profile dir — local to whichever machine launched it, never commit it).
`.env.local` (the shared `DATABASE_URL`) is also gitignored — share it with teammates directly,
not through git.

First visit to `/login` on a fresh (empty) database prompts you to create the admin account.
Everyone after that logs in normally; an admin can register teammates from the same flow.

To test a launch you need a working proxy. Create a profile with a proxy (`http://host:port` +
user/pass), add an account to it, click Launch, and confirm the runner logs `egress IP = <proxy ip>`
before it opens the platform.

---

## 4. Tech stack + key decisions (and WHY)

| Choice | Why |
| --- | --- |
| **Next.js 14 (app router)** | One process = dashboard + API. Route handlers run in Node (`export const runtime = "nodejs"`). |
| **Neon Postgres** via `pg`, NOT `node:sqlite` | Local SQLite couldn't be shared across a team's machines. Neon is a hosted Postgres reachable from every operator's `DATABASE_URL`. Every store function is async now. |
| **`host` column on `accounts`** | A shared DB means a `pid` alone can't tell you if something's running — it's only meaningful on the machine that spawned it. Every launch stamps the launching machine's hostname; `isRunning`/`stopAccount` check `host` before trusting/probing a `pid`. |
| **Cookies + Chromium profile dir stay local files** (not in Postgres) | Deliberate: the persistent browser profile is what keeps a real device fingerprint consistent for an account over time — it should stay pinned to one machine, not sync. Only the *metadata* (profiles/accounts/credentials/activity) is shared. |
| **`playwright-extra` + `puppeteer-extra-plugin-stealth`** | Anti-detection: hides `webdriver`, patches automation tells. `--disable-blink-features=AutomationControlled` on launch. |
| **Spawned child-process "runner"** (`lib/engine/runner.mjs`) owns each browser | Decouples browser lifetime from the web server. A dashboard reload / hot-reload doesn't kill open browsers. The runner owns one account's headed Chromium and exits when the window closes. |
| **Cookie-session auth, hand-rolled** (scrypt + hashed tokens, no JWT/next-auth) | Dependency-light; a session token's SHA-256 hash is the only thing stored, so a DB read alone can't reconstruct a usable cookie. |
| **Windows `taskkill /T` to stop** | A plain kill orphans Chromium (it's a child of the runner). `taskkill /PID <pid> /T /F` kills the whole tree. (Non-Windows uses `process.kill`.) |
| **`serverComponentsExternalPackages`** in `next.config.mjs` | Keeps `playwright*` out of the webpack bundle so they run as real Node modules. |

---

## 5. Architecture / request flow

```
Browser (dashboard)  ──HTTP──►  Next.js API routes (Node runtime)
                                   │
                                   ├─ lib/engine/store.ts      (Postgres/Neon: profiles+accounts+users+activity)
                                   ├─ lib/engine/auth.ts       (login/logout/register, session cookies)
                                   ├─ lib/engine/cookies.ts    (per-account session files)
                                   └─ lib/engine/manager.ts    (spawn/track/stop runners, host-aware)
                                            │ spawn(node, runner.mjs, config.json)
                                            ▼
                                   lib/engine/runner.mjs  ── owns one headed Chromium
                                     (parent profile's proxy + fingerprint, account's OWN
                                      persistent user-data-dir + injected cookies + egress-IP guard)
```

**Launch sequence:** dashboard POSTs `/api/accounts/<id>/launch` → `manager.launchAccount` looks up
the account's parent profile, resolves the fingerprint (+ timezone override), collects that
account's cookies (`cookies.cookiesForLaunch`), writes `data/.accounts/<id>/launch-config.json`,
spawns `runner.mjs <configPath>`, records `pid` + `host` + `status=running` on the account. The
runner opens a **persistent** context (so the session is saved), injects cookies, **asserts egress
IP == proxy**, then navigates to the chosen platform and stays open until the window closes. On
exit the manager flips the account back to `idle` (and `isRunning` self-heals from pid liveness —
but only when `host` matches the current machine).

---

## 6. File-by-file map

**Engine (`lib/engine/`)**
- `store.ts` — Postgres (Neon) store for everything: `Profile`/`Account` CRUD (capped at 3
  accounts per platform per profile), `User`/`LoginSession`/`ActivityEntry` CRUD, and
  `listAccountSessions()` which pairs `account.launch`/`account.stop` activity rows into browser
  sessions. Every function is async. `profileDir(id)`/`accountDir(id)` are the only sync bits
  (plain `fs`, no DB).
- `auth.ts` — password hashing (scrypt), session tokens (random bytes, only the SHA-256 hash is
  stored), `register`/`login`/`logout`/`currentUser`. Cookie name: `lumina_session`.
- `fingerprints.ts` — `FINGERPRINTS` presets (`us-win`, `us-mac`, `mx-win`, `gb-win`), each a
  coherent { userAgent, viewport, deviceScaleFactor, locale, timezoneId, platform }. **Never mix
  incoherent values** (e.g. es-MX locale on a New York timezone is itself a detection tell).
- `manager.ts` — spawns/tracks/stops runners. `launchAccount(id)`, `stopAccount(id)`,
  `isRunning(id)`, `runningIds()` — all host-aware (see §4).
- `runner.mjs` — standalone child process (NOT bundled; plain ESM). Launches the persistent,
  proxied, fingerprinted, stealthed Chromium for one account + the egress-IP guard + cookie
  injection.
- `cookies.ts` — per-account session storage (`data/.accounts/<id>/cookies.json`).
  `normalizeForPlatform` re-domains a pasted `{name:value}` map or cookie array to the platform's
  cookie domains (IG/FB/TikTok/X[both x.com + twitter.com]/YouTube).

**Shared (`lib/`)**
- `platforms.ts` — platform metadata (key, label, brand color) + `MAX_ACCOUNTS_PER_PLATFORM`.

**API (`app/api/`)** — all `runtime="nodejs"`, `dynamic="force-dynamic"`, all (except `auth/*`)
require a logged-in user
- `profiles/route.ts` — GET (list, with nested `accounts`) / POST (create profile).
- `profiles/[id]/route.ts` — GET / PUT (edit; 409 if any of its accounts are running) / DELETE.
- `profiles/[id]/accounts/route.ts` — POST (create account; 400 if that platform is at the cap).
- `accounts/[id]/route.ts` — GET / PUT (edit; 409 if running) / DELETE.
- `accounts/[id]/launch/route.ts`, `.../stop/route.ts` — POST.
- `accounts/[id]/cookies/route.ts` — GET (has a session?) / PUT `{cookies}` / DELETE.
- `auth/status|register|login|logout|me/route.ts` — bootstrap/admin-gated register, login, logout,
  current-user check.
- `activity/route.ts` — GET activity log + derived browser sessions.
- `fingerprints/route.ts` — GET presets.

**UI (`app/` + `components/`)**
- `layout.tsx` — bare `<html><body>` shell (no auth, no sidebar — see below).
- `(app)/layout.tsx` — the actual dashboard shell (`<Sidebar/>` + `<main>`); server component that
  redirects to `/login` if `currentUser()` is null.
- `(app)/page.tsx` — Profiles page: profile clusters, platform tabs, search, create/edit modals.
- `(app)/activity/page.tsx` — browser-session log (primary) + a de-emphasized general action log.
- `login/page.tsx` — public login/bootstrap-admin page, outside the `(app)` guard.
- `globals.css` — the whole design system (dark theme, tokens, clusters, modals). No CSS framework.
- `Sidebar.tsx` — nav (Profiles/Activity are real links now) + current user + logout; automation
  sections still render as latent "SOON".
- `ProfileCard.tsx` — one profile cluster: header bar (proxy/fingerprint/shared-IP warning) +
  accounts grouped by platform with `x/3` counts, each a mini account card.
- `ProfileModal.tsx` — create/edit a profile. `AccountModal.tsx` — create/edit an account (platform
  locked once created; disables platforms already at the cap). `CookiesModal.tsx` — import/clear
  one account's session. `ConfirmModal.tsx` — styled delete confirmations (not `window.confirm`).
  `PlatformIcon.tsx` — inline brand-logo SVGs (lucide-react ships no brand icons).

---

## 7. Data model (Postgres / Neon)

- `profiles` — `id, name, niche, fingerprint_preset, proxy_server, proxy_username, proxy_password,
  timezone_override, notes, created_at`.
- `accounts` — `id, profile_id, platform, username, password, email, twofa, notes,
  status ('idle'|'running'), pid, host, created_at, last_used_at`.
- `users` — `id, username, password_hash, role ('admin'|'operator'), created_at`.
- `login_sessions` — `id, user_id, token_hash, created_at, last_seen_at, ended_at`.
- `activity_log` — `id, user_id, action, target_type, target_id, meta (json text), created_at`.

Cookies and browser profiles are **files**, not DB rows: `data/.accounts/<id>/cookies.json` holds
the raw imported cookies; `data/.accounts/<id>/chromium/` is the persistent browser profile —
both local to whichever machine last launched that account.

---

## 8. Roadmap — what to build next (in order)

The sidebar already lists these as "SOON". Build them in this order; each builds on the last.

1. **Fix the cookie-reinjection issue** (§2, §9) — only inject the imported snapshot on an
   account's first launch.
2. **Warm-up automation + humanization core.** Automate the manual warming (scroll feed, watch,
   like, follow, dwell). **The humanization core is load-bearing** — randomized delays, bezier
   mouse paths, variable scroll, action-rate caps. A naive loop gets accounts banned faster than no
   automation.
3. **Posting + scheduling + content library.** This is the point of the product (theme pages live
   on consistent posting). Two ban-critical pieces:
   - **Content library** with **re-encode/dedup** — never post an exact-duplicate media hash
     (Meta/IG detect reposts); track what's posted where.
   - **Human-cadence scheduler** — per-account daily caps, slow ramp for new accounts, jittered
     timing, timezone-aware windows.
4. **Analytics** — per-account growth/views, best-time-to-post.

---

## 9. Gotchas / lessons (things that will bite you)

- **Cookie reinjection clobbers evolved sessions.** `cookiesForLaunch()` re-reads the same static
  imported `cookies.json` on **every** launch and re-applies it via `context.addCookies()` — even
  if the browser's own persistent cookie jar has since rotated to a newer session token from real
  use. This can regress a working session back to a stale one. Fix: only inject on first launch.
- **A shared DB means a `pid` is not global.** Never trust a `pid` without checking `host` first —
  see `manager.ts`. This bit us as soon as a second machine pointed at the same Neon DB.
- **Dev-mode module instances.** Don't rely on module-level singletons surviving across route
  handlers or hot reloads — that's why lifecycle state lives in the DB (pid + host), not memory.
  The Postgres `Pool` itself is stashed on `globalThis` specifically to survive hot-reloads without
  leaking a new pool each time.
- **Stopping a browser on Windows = tree-kill.** Killing only the runner orphans Chromium; use
  `taskkill /T`. If you ever see stray `chrome.exe` processes piling up, that's almost always
  either an orphan from an interrupted stop, or just the operator's *regular* Chrome browser with
  many tabs open — check the command line / parent pid before assuming it's this app's doing.
- **Persistent context saves everything.** Cookies injected at launch get written into the
  `chromium/` dir, so an account can appear "logged in" from stored state even without an imported
  cookie file. To truly reset, clear both `cookies.json` and the `chromium/` dir.
- **Datacenter-class proxies read as datacenter-class, no matter the fraud score.** A low
  Scamalytics/IPQS fraud score means an IP hasn't been *caught* abusing yet — it doesn't mean the
  IP *looks* residential. Check the ASN/org (NTT, Cogent, GTT, etc. are backbone/transit providers
  proxy resellers commonly lease from) before trusting a proxy for a high-value account.
- **`data/` and `.env.local` are secret.** Proxy creds, account passwords/2FA, live sessions, and
  the shared `DATABASE_URL`. Both gitignored — keep it that way, and share `.env.local` with
  teammates directly, never through git.

---

## 10. Anti-detection principles (inform every automation feature)

These are *why* the burner survived and must guide Phases 3–4:
- **One consistent IP per account** (static residential/mobile ideally), never rotated
  mid-session. Max **3 accounts per platform per IP** — more than that stops reading as
  "plausible household" and starts reading as a farm, independent of fingerprint differences.
- **Coherent, pinned fingerprint** per account (IP geo must match timezone/locale).
- **Behave like a person, act slowly.** Bans are driven by *actions* (mass follow/like, spammy
  posting, high-rate scraping) far more than by passive viewing. Human cadence + volume caps.
- **Identity-altering changes (username, bio, name) are the most heavily scrutinized actions** —
  they resemble account-takeover behavior. Do them late, one at a time, after an account has real
  activity history — never right after creation/import, never stacked together.
- **Views are monotonic** (relevant if you add scraping): never let a re-read lower a stored count.
- **Back off at the first sign of a soft-block / "suspect automated behavior" warning.**

---

## 11. Conventions

- Commits so far are small and scoped (`feat:` / `fix:`), co-authored. Keep that.
- Never commit `data/`, `.env*`, or any secret.
- Typecheck before committing: `npx tsc --noEmit`.
- The app is intentionally dependency-light (no CSS framework, no ORM — raw SQL via `pg`). Prefer that.
