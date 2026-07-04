// Postgres-backed store (Neon). Two entities:
//   Profile = the identity/IP template: fingerprint preset + bound proxy +
//     timezone. This is what must stay consistent for anti-ban.
//   Account = one platform login riding on a profile — username/password +
//     its own cookies + its own isolated persistent browser session. A single
//     profile (one IP) can hold several accounts (e.g. two Instagram logins),
//     each launched independently but always through its parent profile's
//     proxy + fingerprint.
// Shared across every operator's machine via DATABASE_URL (Neon) — so the
// team sees the same profiles/accounts/proxies. What does NOT sync: cookies
// and each account's persistent Chromium user-data-dir, which stay local
// files (data/.accounts/{id}/) on whichever machine actually launches that
// account — see accounts.host, checked in lib/engine/manager.ts, which is
// what keeps run-state correct across multiple machines sharing this DB.
import { Pool, types } from "pg"
import path from "node:path"
import fs from "node:fs"
import { MAX_ACCOUNTS_PER_PLATFORM } from "@/lib/platforms"

// pg returns timestamptz as a JS Date by default; the rest of the app treats
// created_at/last_used_at/etc as ISO strings (see the timeAgo() helpers), so
// normalize at the driver level instead of touching every call site.
types.setTypeParser(1114, (v) => new Date(v + "Z").toISOString()) // timestamp (no tz) — treat as UTC
types.setTypeParser(1184, (v) => new Date(v).toISOString()) // timestamptz

const DATA_DIR = path.join(process.cwd(), "data")
fs.mkdirSync(DATA_DIR, { recursive: true })
export const PROFILES_DIR = path.join(DATA_DIR, ".profiles")
fs.mkdirSync(PROFILES_DIR, { recursive: true })
export const ACCOUNTS_DIR = path.join(DATA_DIR, ".accounts")
fs.mkdirSync(ACCOUNTS_DIR, { recursive: true })

export type Profile = {
  id: number
  name: string
  niche: string | null
  fingerprint_preset: string
  proxy_server: string | null
  proxy_username: string | null
  proxy_password: string | null
  timezone_override: string | null
  notes: string | null
  created_at: string
}

export type ProfileInput = {
  name: string
  niche?: string | null
  fingerprint_preset?: string
  proxy_server?: string | null
  proxy_username?: string | null
  proxy_password?: string | null
  timezone_override?: string | null
  notes?: string | null
}

export type Account = {
  id: number
  profile_id: number
  platform: string
  username: string
  password: string | null
  email: string | null
  twofa: string | null
  notes: string | null
  status: string // "idle" | "running"
  pid: number | null // OS pid of the running browser runner, meaningful only on `host`
  host: string | null // hostname that launched it — a pid only makes sense on its own machine
  created_at: string
  last_used_at: string | null
}

export type AccountInput = {
  platform: string
  username: string
  password?: string | null
  email?: string | null
  twofa?: string | null
  notes?: string | null
}

export type User = {
  id: number
  username: string
  password_hash: string
  role: string // "admin" | "operator"
  created_at: string
}

export type LoginSession = {
  id: number
  user_id: number
  token_hash: string
  created_at: string
  last_seen_at: string
  ended_at: string | null
}

export type ActivityEntry = {
  id: number
  user_id: number | null
  username: string | null
  action: string
  target_type: string | null
  target_id: number | null
  meta: string | null
  created_at: string
}

// A launched-browser session for one account, derived by pairing its
// account.launch/account.stop activity rows — not the operator's dashboard
// login session (see LoginSession above).
export type BrowserSession = {
  accountId: number
  username: string | null
  platform: string | null
  profileName: string | null
  launchedByUsername: string | null
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

// Singleton pool, surviving Next.js dev hot-reloads via globalThis (a fresh
// module instance per reload would otherwise leak a new pool each time).
declare global {
  // eslint-disable-next-line no-var
  var __luminaPgPool: Pool | undefined
}
function pool(): Pool {
  if (!global.__luminaPgPool) {
    global.__luminaPgPool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return global.__luminaPgPool
}

async function q<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready()
  const res = await pool().query(text, params)
  return res.rows as T[]
}
async function q1<T = unknown>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await q<T>(text, params)
  return rows[0]
}

let _ready: Promise<void> | null = null
function ready(): Promise<void> {
  if (!_ready) _ready = ensureSchema()
  return _ready
}
async function ensureSchema(): Promise<void> {
  const p = pool()
  await p.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      niche TEXT,
      fingerprint_preset TEXT NOT NULL DEFAULT 'us-win',
      proxy_server TEXT,
      proxy_username TEXT,
      proxy_password TEXT,
      timezone_override TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
  await p.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      platform TEXT NOT NULL DEFAULT 'instagram',
      username TEXT NOT NULL,
      password TEXT,
      email TEXT,
      twofa TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pid INTEGER,
      host TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ
    );
  `)
  await p.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS host TEXT;`)
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
  await p.query(`
    CREATE TABLE IF NOT EXISTS login_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ
    );
  `)
  await p.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      meta TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
}

// ── Profiles ──────────────────────────────────────────────────────────────

export function listProfiles(): Promise<Profile[]> {
  return q<Profile>("SELECT * FROM profiles ORDER BY created_at DESC")
}

export function getProfile(id: number): Promise<Profile | undefined> {
  return q1<Profile>("SELECT * FROM profiles WHERE id = $1", [id])
}

export function createProfile(input: ProfileInput): Promise<Profile> {
  return q1<Profile>(
    `INSERT INTO profiles (name, niche, fingerprint_preset, proxy_server, proxy_username, proxy_password, timezone_override, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      input.name,
      input.niche ?? null,
      input.fingerprint_preset ?? "us-win",
      input.proxy_server ?? null,
      input.proxy_username ?? null,
      input.proxy_password ?? null,
      input.timezone_override ?? null,
      input.notes ?? null,
    ],
  ) as Promise<Profile>
}

export async function updateProfile(id: number, patch: Partial<ProfileInput>): Promise<Profile | undefined> {
  const allowed = [
    "name", "niche", "fingerprint_preset", "proxy_server",
    "proxy_username", "proxy_password", "timezone_override", "notes",
  ] as const
  const sets: string[] = []
  const params: unknown[] = []
  for (const key of allowed) {
    const v = (patch as Record<string, unknown>)[key]
    if (v === undefined) continue
    params.push(v)
    sets.push(`${key} = $${params.length}`)
  }
  if (!sets.length) return getProfile(id)
  params.push(id)
  return q1<Profile>(`UPDATE profiles SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params)
}

export async function deleteProfile(id: number): Promise<boolean> {
  for (const a of await listAccounts(id)) await deleteAccount(a.id)
  const rows = await q("DELETE FROM profiles WHERE id = $1 RETURNING id", [id])
  try {
    fs.rmSync(path.join(PROFILES_DIR, String(id)), { recursive: true, force: true })
  } catch {
    /* nothing to clean up */
  }
  return rows.length > 0
}

export function profileDir(id: number): string {
  const dir = path.join(PROFILES_DIR, String(id))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Accounts ──────────────────────────────────────────────────────────────

export function listAccounts(profileId: number): Promise<Account[]> {
  return q<Account>("SELECT * FROM accounts WHERE profile_id = $1 ORDER BY created_at ASC", [profileId])
}

export function listAllAccounts(): Promise<Account[]> {
  return q<Account>("SELECT * FROM accounts ORDER BY created_at ASC")
}

export function getAccount(id: number): Promise<Account | undefined> {
  return q1<Account>("SELECT * FROM accounts WHERE id = $1", [id])
}

export function createAccount(profileId: number, input: AccountInput): Promise<Account> {
  return q1<Account>(
    `INSERT INTO accounts (profile_id, platform, username, password, email, twofa, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [profileId, input.platform, input.username, input.password ?? null, input.email ?? null, input.twofa ?? null, input.notes ?? null],
  ) as Promise<Account>
}

export async function updateAccount(
  id: number,
  patch: Partial<AccountInput> & { status?: string; last_used_at?: string; pid?: number | null; host?: string | null },
): Promise<Account | undefined> {
  const allowed = ["platform", "username", "password", "email", "twofa", "notes", "status", "last_used_at", "pid", "host"] as const
  const sets: string[] = []
  const params: unknown[] = []
  for (const key of allowed) {
    const v = (patch as Record<string, unknown>)[key]
    if (v === undefined) continue
    params.push(v)
    sets.push(`${key} = $${params.length}`)
  }
  if (!sets.length) return getAccount(id)
  params.push(id)
  return q1<Account>(`UPDATE accounts SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params)
}

export async function deleteAccount(id: number): Promise<boolean> {
  const rows = await q("DELETE FROM accounts WHERE id = $1 RETURNING id", [id])
  try {
    fs.rmSync(path.join(ACCOUNTS_DIR, String(id)), { recursive: true, force: true })
  } catch {
    /* nothing to clean up */
  }
  return rows.length > 0
}

export function accountDir(id: number): string {
  const dir = path.join(ACCOUNTS_DIR, String(id))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// Accounts of the same platform sharing one IP/fingerprint are the thing
// platforms cluster on — cap per (profile, platform), not just per profile.
export async function countAccountsForPlatform(profileId: number, platform: string): Promise<number> {
  const row = await q1<{ n: string }>("SELECT COUNT(*) as n FROM accounts WHERE profile_id = $1 AND platform = $2", [profileId, platform])
  return Number(row?.n ?? 0)
}
export { MAX_ACCOUNTS_PER_PLATFORM }

// ── Users / sessions / activity ─────────────────────────────────────────────

export function listUsers(): Promise<User[]> {
  return q<User>("SELECT * FROM users ORDER BY created_at ASC")
}

export function getUserByUsername(username: string): Promise<User | undefined> {
  return q1<User>("SELECT * FROM users WHERE username = $1", [username])
}

export function createUserWithHash(username: string, passwordHash: string, role: string): Promise<User> {
  return q1<User>(
    "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING *",
    [username, passwordHash, role],
  ) as Promise<User>
}

export function createLoginSession(userId: number, tokenHash: string): Promise<LoginSession> {
  return q1<LoginSession>(
    "INSERT INTO login_sessions (user_id, token_hash) VALUES ($1, $2) RETURNING *",
    [userId, tokenHash],
  ) as Promise<LoginSession>
}

export function findActiveSession(tokenHash: string): Promise<(LoginSession & { username: string; role: string }) | undefined> {
  return q1<LoginSession & { username: string; role: string }>(
    `SELECT ls.*, u.username, u.role FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id
     WHERE ls.token_hash = $1 AND ls.ended_at IS NULL`,
    [tokenHash],
  )
}

export async function touchSession(tokenHash: string): Promise<void> {
  await q("UPDATE login_sessions SET last_seen_at = now() WHERE token_hash = $1 AND ended_at IS NULL", [tokenHash])
}

export async function endSession(tokenHash: string): Promise<void> {
  await q("UPDATE login_sessions SET ended_at = now() WHERE token_hash = $1", [tokenHash])
}

export async function logActivity(
  userId: number | null, action: string, targetType?: string, targetId?: number, meta?: Record<string, unknown>,
): Promise<void> {
  await q(
    `INSERT INTO activity_log (user_id, action, target_type, target_id, meta) VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, targetType ?? null, targetId ?? null, meta ? JSON.stringify(meta) : null],
  )
}

export function listActivity(limit = 200): Promise<ActivityEntry[]> {
  return q<ActivityEntry>(
    `SELECT al.*, u.username FROM activity_log al LEFT JOIN users u ON u.id = al.user_id ORDER BY al.created_at DESC LIMIT $1`,
    [limit],
  )
}

// Pairs each account.launch with the account.stop that follows it (per
// account) into a browser-session row. A launch with no matching stop yet is
// still-running. Reads meta captured at launch/stop time, so sessions stay
// intact even if the account or profile is later renamed or deleted.
export async function listAccountSessions(limit = 200): Promise<BrowserSession[]> {
  const rows = await q<Omit<ActivityEntry, "meta"> & { meta: string | null; actor: string | null }>(
    `SELECT al.*, u.username as actor FROM activity_log al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE al.action IN ('account.launch', 'account.stop')
     ORDER BY al.created_at ASC`,
  )

  const open = new Map<number, Omit<ActivityEntry, "meta"> & { actor: string | null; meta: Record<string, unknown> }>()
  const sessions: BrowserSession[] = []

  for (const row of rows) {
    const meta = (row.meta ? JSON.parse(row.meta) : {}) as Record<string, unknown>
    const accountId = row.target_id as number
    if (row.action === "account.launch") {
      open.set(accountId, { ...row, meta })
    } else {
      const start = open.get(accountId)
      open.delete(accountId)
      sessions.push({
        accountId,
        username: (meta.username ?? start?.meta.username ?? null) as string | null,
        platform: (meta.platform ?? start?.meta.platform ?? null) as string | null,
        profileName: (meta.profileName ?? start?.meta.profileName ?? null) as string | null,
        launchedByUsername: start?.actor ?? null,
        startedAt: start?.created_at ?? row.created_at,
        endedAt: row.created_at,
        durationSeconds: typeof meta.durationSeconds === "number" ? meta.durationSeconds : null,
      })
    }
  }
  for (const start of open.values()) {
    sessions.push({
      accountId: start.target_id as number,
      username: (start.meta.username ?? null) as string | null,
      platform: (start.meta.platform ?? null) as string | null,
      profileName: (start.meta.profileName ?? null) as string | null,
      launchedByUsername: start.actor,
      startedAt: start.created_at,
      endedAt: null,
      durationSeconds: null,
    })
  }

  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return sessions.slice(0, limit)
}
