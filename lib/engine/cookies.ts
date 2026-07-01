// Per-profile, per-platform session cookies. Lets you import a warmed account's
// session (paste the cookies from DevTools, or a { name: value } map like the
// burner cookies.json) so a profile launches ALREADY logged in to that platform.
// Stored as raw JSON files under the profile dir; normalized to Playwright
// cookies (re-domained to the platform) at launch time.

import fs from "node:fs"
import path from "node:path"
import { profileDir } from "./store"

export type PWCookie = {
  name: string; value: string; domain: string; path: string
  secure: boolean; httpOnly: boolean; sameSite: "Lax" | "Strict" | "None"
}

// Which cookie domains a platform's session lives on.
const COOKIE_TARGETS: Record<string, string[]> = {
  instagram: [".instagram.com"],
  facebook: [".facebook.com"],
  tiktok: [".tiktok.com"],
  twitter: [".x.com", ".twitter.com"],
  youtube: [".youtube.com", ".google.com"],
}
const HTTPONLY = new Set(["sessionid", "datr", "xs", "ds_user_id", "sid", "LOGIN_INFO", "HSID", "SSID"])

function dir(id: number): string {
  const d = path.join(profileDir(id), "cookies")
  fs.mkdirSync(d, { recursive: true })
  return d
}
function file(id: number, platform: string): string {
  return path.join(dir(id), `${platform}.json`)
}

export function setCookies(id: number, platform: string, raw: unknown): void {
  fs.writeFileSync(file(id, platform), JSON.stringify(raw, null, 2), "utf8")
}
export function getRawCookies(id: number, platform: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file(id, platform), "utf8"))
  } catch {
    return null
  }
}
export function deleteCookies(id: number, platform: string): void {
  try { fs.unlinkSync(file(id, platform)) } catch {}
}
export function platformsWithCookies(id: number): string[] {
  try {
    return fs.readdirSync(dir(id)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  } catch {
    return []
  }
}

// Accepts either a { name: value } object (burner format) or an array of cookie
// objects (DevTools/EditThisCookie export). Re-domains to the platform's targets.
export function normalizeForPlatform(raw: unknown, platform: string): PWCookie[] {
  const targets = COOKIE_TARGETS[platform] || []
  if (!targets.length) return []
  let pairs: { name: string; value: string }[] = []
  if (Array.isArray(raw)) {
    pairs = raw
      .map((c: any) => ({ name: c?.name, value: c?.value != null ? String(c.value) : "" }))
      .filter((c) => c.name)
  } else if (raw && typeof raw === "object") {
    pairs = Object.entries(raw as Record<string, unknown>)
      .filter(([k]) => k !== "_comment")
      .map(([name, value]) => ({ name, value: String(value) }))
  }
  const out: PWCookie[] = []
  for (const domain of targets) {
    for (const { name, value } of pairs) {
      out.push({ name, value, domain, path: "/", secure: true, httpOnly: HTTPONLY.has(name), sameSite: "Lax" })
    }
  }
  return out
}

export function cookiesForLaunch(id: number, platform: string): PWCookie[] {
  const raw = getRawCookies(id, platform)
  return raw ? normalizeForPlatform(raw, platform) : []
}
