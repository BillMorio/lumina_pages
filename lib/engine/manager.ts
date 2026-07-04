// Engine manager: spawns/tracks/stops the per-account browser runners.
//
// State is PID-based via the DB (not an in-memory Map): Next.js dev can give
// different route handlers separate module instances, so an in-memory registry
// populated by /launch isn't reliably visible to /stop. The runner's OS pid is
// written to the accounts table on launch and is the single source of truth.
// Status self-heals from process liveness, so a browser closed by the operator
// (or a crashed runner) correctly reads back as idle even if no exit handler ran.
//
// The DB (Neon) is now shared across every operator's machine, so a pid alone
// is no longer enough — pid 4821 on your laptop and pid 4821 on a teammate's
// desktop are unrelated processes. Every launch also stamps `host` (this
// machine's hostname); liveness is only checked locally when `host` matches
// this machine. A mismatch means "running on someone else's machine" — we
// trust the DB rather than probing a meaningless local pid, and stop requests
// are refused there since only the owning machine can actually kill it.
//
// An account launches through its PARENT PROFILE's proxy + fingerprint (so IP
// and fingerprint stay consistent for every account riding on that identity),
// but into its OWN persistent Chromium user-data-dir — so two accounts under
// the same profile can run concurrently without their sessions colliding.

import { spawn, execFile } from "node:child_process"
import { hostname } from "node:os"
import path from "node:path"
import fs from "node:fs"
import { getAccount, updateAccount, getProfile, accountDir, listAllAccounts } from "./store"
import { resolveFingerprint } from "./fingerprints"
import { cookiesForLaunch } from "./cookies"

const RUNNER = path.join(process.cwd(), "lib", "engine", "runner.mjs")
const HOST = hostname()

// A pid is "alive" if signalling it doesn't throw. Local single-user app, so
// PID reuse is an acceptable non-risk.
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function isRunning(accountId: number): Promise<boolean> {
  const a = await getAccount(accountId)
  if (!a || !a.pid) return false
  if (a.host && a.host !== HOST) return true // running on another machine — trust the DB, don't probe a foreign pid
  if (alive(a.pid)) return true
  // self-heal: recorded pid is dead on this machine (browser closed / runner exited)
  await updateAccount(accountId, { status: "idle", pid: null, host: null })
  return false
}

export async function runningIds(): Promise<number[]> {
  const accounts = await listAllAccounts()
  const flags = await Promise.all(accounts.map((a) => (a.pid ? isRunning(a.id) : Promise.resolve(false))))
  return accounts.filter((_, i) => flags[i]).map((a) => a.id)
}

export async function launchAccount(accountId: number): Promise<{ ok: boolean; error?: string }> {
  if (await isRunning(accountId)) return { ok: false, error: "Account is already running" }
  const account = await getAccount(accountId)
  if (!account) return { ok: false, error: "Account not found" }
  const profile = await getProfile(account.profile_id)
  if (!profile) return { ok: false, error: "Parent profile not found" }

  const fp = { ...resolveFingerprint(profile.fingerprint_preset) }
  if (profile.timezone_override) fp.timezoneId = profile.timezone_override

  const dir = accountDir(accountId)
  const cfg = {
    id: account.id,
    name: `${profile.name} · ${account.username}`,
    platform: account.platform,
    // Inject the warmed session for this account, if one was imported, so it
    // lands already logged in.
    cookies: await cookiesForLaunch(accountId),

    fingerprint: fp,
    proxy: profile.proxy_server
      ? { server: profile.proxy_server, username: profile.proxy_username, password: profile.proxy_password }
      : null,
    userDataDir: path.join(dir, "chromium"),
  }
  fs.writeFileSync(path.join(dir, "launch-config.json"), JSON.stringify(cfg, null, 2))

  const child = spawn(process.execPath, [RUNNER, path.join(dir, "launch-config.json")], {
    cwd: process.cwd(),
    stdio: "inherit",
    detached: false,
  })

  await updateAccount(accountId, { status: "running", pid: child.pid ?? null, host: HOST, last_used_at: new Date().toISOString() })

  // Best-effort local cleanup when the operator closes the window. isRunning()
  // self-heals anyway if this doesn't fire in the current module instance.
  child.on("exit", () => {
    getAccount(accountId).then((cur) => {
      if (cur?.pid === child.pid) updateAccount(accountId, { status: "idle", pid: null, host: null })
    })
  })
  child.on("error", () => {
    getAccount(accountId).then((cur) => {
      if (cur?.pid === child.pid) updateAccount(accountId, { status: "idle", pid: null, host: null })
    })
  })

  return { ok: true }
}

export async function stopAccount(accountId: number): Promise<{ ok: boolean; error?: string }> {
  const a = await getAccount(accountId)
  if (!a || !a.pid) return { ok: false, error: "Account is not running" }
  if (a.host && a.host !== HOST) return { ok: false, error: `Running on ${a.host} — stop it from that machine` }
  const pid = a.pid
  // Kill the runner AND its Chromium child tree. On Windows a plain kill orphans
  // the browser (Chromium is a child of the runner) — taskkill /T kills the tree.
  if (process.platform === "win32") {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], () => {})
  } else {
    try {
      process.kill(pid)
    } catch {
      /* already gone */
    }
  }
  await updateAccount(accountId, { status: "idle", pid: null, host: null })
  return { ok: true }
}
