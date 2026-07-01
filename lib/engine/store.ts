// SQLite-backed profile store. A Profile is the unit of the app: one social
// account identity = { fingerprint preset + bound proxy + persistent session +
// niche/label }. Local-only (data/lumina.db); proxy creds live here and never
// leave the machine (data/ is gitignored). Phase 2 adds a shared cloud DB for
// team coordination on top of this same shape.

// Uses Node's built-in SQLite (node:sqlite) — no native build step, works on
// Node 24. API mirrors better-sqlite3 (prepare/get/all/run, @named params,
// lastInsertRowid/changes).
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import fs from "node:fs"

const DATA_DIR = path.join(process.cwd(), "data")
fs.mkdirSync(DATA_DIR, { recursive: true })
export const PROFILES_DIR = path.join(DATA_DIR, ".profiles")
fs.mkdirSync(PROFILES_DIR, { recursive: true })

export type Profile = {
  id: number
  name: string
  niche: string | null
  platform: string
  fingerprint_preset: string
  proxy_server: string | null
  proxy_username: string | null
  proxy_password: string | null
  timezone_override: string | null
  notes: string | null
  status: string // "idle" | "running"
  pid: number | null // OS pid of the running browser runner (source of truth for stop/status)
  created_at: string
  last_used_at: string | null
}

export type ProfileInput = {
  name: string
  niche?: string | null
  platform?: string
  fingerprint_preset?: string
  proxy_server?: string | null
  proxy_username?: string | null
  proxy_password?: string | null
  timezone_override?: string | null
  notes?: string | null
}

// Single connection reused across the server process.
let _db: DatabaseSync | null = null
function db(): DatabaseSync {
  if (_db) return _db
  _db = new DatabaseSync(path.join(DATA_DIR, "lumina.db"))
  _db.exec("PRAGMA journal_mode = WAL;")
  _db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      niche TEXT,
      platform TEXT NOT NULL DEFAULT 'instagram',
      fingerprint_preset TEXT NOT NULL DEFAULT 'us-win',
      proxy_server TEXT,
      proxy_username TEXT,
      proxy_password TEXT,
      timezone_override TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pid INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    );
  `)
  // Migration for DBs created before the pid column existed.
  try {
    _db.exec("ALTER TABLE profiles ADD COLUMN pid INTEGER;")
  } catch {
    /* column already exists */
  }
  return _db
}

export function listProfiles(): Profile[] {
  return db().prepare("SELECT * FROM profiles ORDER BY created_at DESC").all() as Profile[]
}

export function getProfile(id: number): Profile | undefined {
  return db().prepare("SELECT * FROM profiles WHERE id = ?").get(id) as Profile | undefined
}

export function createProfile(input: ProfileInput): Profile {
  const info = db()
    .prepare(
      `INSERT INTO profiles (name, niche, platform, fingerprint_preset, proxy_server, proxy_username, proxy_password, timezone_override, notes)
       VALUES (@name, @niche, @platform, @fingerprint_preset, @proxy_server, @proxy_username, @proxy_password, @timezone_override, @notes)`,
    )
    .run({
      name: input.name,
      niche: input.niche ?? null,
      platform: input.platform ?? "instagram",
      fingerprint_preset: input.fingerprint_preset ?? "us-win",
      proxy_server: input.proxy_server ?? null,
      proxy_username: input.proxy_username ?? null,
      proxy_password: input.proxy_password ?? null,
      timezone_override: input.timezone_override ?? null,
      notes: input.notes ?? null,
    })
  return getProfile(Number(info.lastInsertRowid))!
}

export function updateProfile(id: number, patch: Partial<ProfileInput> & { status?: string; last_used_at?: string; pid?: number | null }): Profile | undefined {
  const existing = getProfile(id)
  if (!existing) return undefined
  const allowed = [
    "name", "niche", "platform", "fingerprint_preset", "proxy_server",
    "proxy_username", "proxy_password", "timezone_override", "notes", "status", "last_used_at", "pid",
  ] as const
  const sets: string[] = []
  // Values are DB-safe scalars (string | number | null); typed loose for node:sqlite's run() overload.
  const params: Record<string, string | number | bigint | null> = { id }
  for (const key of allowed) {
    if (key in patch) {
      const v = (patch as Record<string, unknown>)[key]
      sets.push(`${key} = @${key}`)
      params[key] = (v ?? null) as string | number | bigint | null
    }
  }
  if (sets.length) db().prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE id = @id`).run(params)
  return getProfile(id)
}

export function deleteProfile(id: number): boolean {
  const info = db().prepare("DELETE FROM profiles WHERE id = ?").run(id)
  return info.changes > 0
}

export function profileDir(id: number): string {
  const dir = path.join(PROFILES_DIR, String(id))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
