// Engine manager: spawns/tracks/stops the per-profile browser runners.
//
// State is PID-based via the DB (not an in-memory Map): Next.js dev can give
// different route handlers separate module instances, so an in-memory registry
// populated by /launch isn't reliably visible to /stop. The runner's OS pid is
// written to the profiles table on launch and is the single source of truth.
// Status self-heals from process liveness, so a browser closed by the operator
// (or a crashed runner) correctly reads back as idle even if no exit handler ran.

import { spawn, execFile } from "node:child_process"
import path from "node:path"
import fs from "node:fs"
import { getProfile, updateProfile, profileDir, listProfiles } from "./store"
import { resolveFingerprint } from "./fingerprints"

const RUNNER = path.join(process.cwd(), "lib", "engine", "runner.mjs")

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

export function isRunning(id: number): boolean {
  const p = getProfile(id)
  if (!p || !p.pid) return false
  if (alive(p.pid)) return true
  // self-heal: recorded pid is dead (browser closed / runner exited)
  updateProfile(id, { status: "idle", pid: null })
  return false
}

export function runningIds(): number[] {
  return listProfiles().filter((p) => p.pid && isRunning(p.id)).map((p) => p.id)
}

export function launchProfile(id: number): { ok: boolean; error?: string } {
  if (isRunning(id)) return { ok: false, error: "Profile is already running" }
  const profile = getProfile(id)
  if (!profile) return { ok: false, error: "Profile not found" }

  const fp = { ...resolveFingerprint(profile.fingerprint_preset) }
  if (profile.timezone_override) fp.timezoneId = profile.timezone_override

  const dir = profileDir(id)
  const cfg = {
    id: profile.id,
    name: profile.name,
    platform: profile.platform,
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

  updateProfile(id, { status: "running", pid: child.pid ?? null, last_used_at: new Date().toISOString() })

  // Best-effort local cleanup when the operator closes the window. isRunning()
  // self-heals anyway if this doesn't fire in the current module instance.
  child.on("exit", () => {
    const cur = getProfile(id)
    if (cur?.pid === child.pid) updateProfile(id, { status: "idle", pid: null })
  })
  child.on("error", () => {
    const cur = getProfile(id)
    if (cur?.pid === child.pid) updateProfile(id, { status: "idle", pid: null })
  })

  return { ok: true }
}

export function stopProfile(id: number): { ok: boolean; error?: string } {
  const p = getProfile(id)
  if (!p || !p.pid) return { ok: false, error: "Profile is not running" }
  const pid = p.pid
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
  updateProfile(id, { status: "idle", pid: null })
  return { ok: true }
}
