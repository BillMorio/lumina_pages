// Engine manager: spawns/tracks/stops the per-profile browser runners. Holds a
// module-level registry of running children (persists in the Next.js server
// process), so the dashboard can launch, see live status, and stop profiles.
// Browser lifetime is decoupled from the web server — a runner owns its browser
// and reports back on exit.

import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import fs from "node:fs"
import { getProfile, updateProfile, profileDir } from "./store"
import { resolveFingerprint } from "./fingerprints"

type Running = { child: ChildProcess; startedAt: number }
const running = new Map<number, Running>()

const RUNNER = path.join(process.cwd(), "lib", "engine", "runner.mjs")

export function isRunning(id: number): boolean {
  return running.has(id)
}

export function runningIds(): number[] {
  return [...running.keys()]
}

export function launchProfile(id: number): { ok: boolean; error?: string } {
  if (running.has(id)) return { ok: false, error: "Profile is already running" }
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
  const cfgPath = path.join(dir, "launch-config.json")
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2))

  const child = spawn(process.execPath, [RUNNER, cfgPath], {
    cwd: process.cwd(),
    stdio: "inherit",
    detached: false,
  })

  running.set(id, { child, startedAt: Date.now() })
  updateProfile(id, { status: "running", last_used_at: new Date().toISOString() })

  child.on("exit", () => {
    running.delete(id)
    updateProfile(id, { status: "idle" })
  })
  child.on("error", () => {
    running.delete(id)
    updateProfile(id, { status: "idle" })
  })

  return { ok: true }
}

export function stopProfile(id: number): { ok: boolean; error?: string } {
  const r = running.get(id)
  if (!r) return { ok: false, error: "Profile is not running" }
  try {
    r.child.kill()
  } catch {
    /* already gone */
  }
  running.delete(id)
  updateProfile(id, { status: "idle" })
  return { ok: true }
}
