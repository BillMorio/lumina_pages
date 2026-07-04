// Per-account session cookies. Lets you import a warmed account's session
// (paste the cookies from DevTools, or a { name: value } map like the burner
// cookies.json) so an account launches ALREADY logged in. An account has one
// fixed platform, so there's exactly one cookie file per account. Stored as a
// raw JSON file under the account dir; normalized to Playwright cookies
// (re-domained to the platform) at launch time.

import fs from "node:fs"
import path from "node:path"
import { accountDir, getAccount } from "./store"

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

function file(accountId: number): string {
  return path.join(accountDir(accountId), "cookies.json")
}

export function setCookies(accountId: number, raw: unknown): void {
  fs.writeFileSync(file(accountId), JSON.stringify(raw, null, 2), "utf8")
}
export function getRawCookies(accountId: number): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file(accountId), "utf8"))
  } catch {
    return null
  }
}
export function deleteCookies(accountId: number): void {
  try { fs.unlinkSync(file(accountId)) } catch {}
}
export function hasCookies(accountId: number): boolean {
  return fs.existsSync(file(accountId))
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

export async function cookiesForLaunch(accountId: number): Promise<PWCookie[]> {
  const account = await getAccount(accountId)
  if (!account) return []
  const raw = getRawCookies(accountId)
  return raw ? normalizeForPlatform(raw, account.platform) : []
}
