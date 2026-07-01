// Standalone profile-browser runner. Spawned as a child process by the engine
// manager with a single arg: the path to a JSON config for ONE profile. Opens a
// stealthed, proxied, fingerprinted, PERSISTENT Chromium so the operator can log
// in / warm / run the account. Owns the browser for its whole lifetime — closing
// the window ends this process (which the manager watches to flip status back to
// idle). Decoupling the browser from the web server keeps sessions robust across
// dashboard reloads.
//
// Hard safety: if the profile has a proxy, we assert the egress IP equals the
// proxy's IP BEFORE touching the platform — so an account is never exposed on the
// operator's real home IP by accident.

import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { readFileSync, mkdirSync } from "node:fs"

chromium.use(StealthPlugin())

const configPath = process.argv[2]
if (!configPath) {
  console.error("runner: missing config path arg")
  process.exit(1)
}
const cfg = JSON.parse(readFileSync(configPath, "utf8"))
const { id, name, platform, fingerprint: fp, proxy, userDataDir, cookies } = cfg

const PLATFORM_URL = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  tiktok: "https://www.tiktok.com/",
  twitter: "https://x.com/",
  youtube: "https://www.youtube.com/",
}

mkdirSync(userDataDir, { recursive: true })

const proxyOpt = proxy?.server
  ? { server: proxy.server, ...(proxy.username ? { username: proxy.username } : {}), ...(proxy.password ? { password: proxy.password } : {}) }
  : undefined

console.log(`[profile ${id}] "${name}" launching — preset fp, tz=${fp.timezoneId}, proxy=${proxy?.server || "NONE (home IP)"}`)

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  ...(proxyOpt ? { proxy: proxyOpt } : {}),
  userAgent: fp.userAgent,
  viewport: fp.viewport,
  deviceScaleFactor: fp.deviceScaleFactor,
  locale: fp.locale,
  timezoneId: fp.timezoneId,
  args: ["--disable-blink-features=AutomationControlled"],
})

await context.addInitScript(
  ({ platform, locale }) => {
    try {
      Object.defineProperty(navigator, "platform", { get: () => platform })
      Object.defineProperty(navigator, "languages", { get: () => [locale, locale.split("-")[0]] })
    } catch {}
  },
  { platform: fp.platform || "Win32", locale: fp.locale || "en-US" },
)

// Inject the imported session cookies for this platform (if any) so we land
// logged in. Done before navigating; addCookies is a no-op for an empty list.
if (Array.isArray(cookies) && cookies.length) {
  try {
    await context.addCookies(cookies)
    console.log(`[profile ${id}] injected ${cookies.length} ${platform} session cookies`)
  } catch (e) {
    console.log(`[profile ${id}] cookie injection failed: ${e.message}`)
  }
}

const page = context.pages()[0] || (await context.newPage())

// HARD GUARD: confirm egress IP is the proxy before touching the platform.
if (proxy?.server) {
  const expectedIp = (proxy.server.match(/(\d+\.\d+\.\d+\.\d+)/) || [])[1]
  try {
    await page.goto("https://api.ipify.org?format=json", { timeout: 30000 })
    const egress = JSON.parse(await page.evaluate(() => document.body?.innerText || "{}")).ip
    console.log(`[profile ${id}] egress IP = ${egress} (expected ${expectedIp})`)
    if (expectedIp && egress !== expectedIp) {
      console.error(`[profile ${id}] ABORT: egress IP is NOT the proxy — closing so the account is never exposed on the home IP.`)
      await context.close().catch(() => {})
      process.exit(2)
    }
  } catch (e) {
    console.error(`[profile ${id}] ABORT: could not confirm egress IP (${e.message}) — closing to stay safe.`)
    await context.close().catch(() => {})
    process.exit(2)
  }
}

try {
  const resp = await page.goto(PLATFORM_URL[platform] || PLATFORM_URL.instagram, { timeout: 60000, waitUntil: "domcontentloaded" })
  console.log(`[profile ${id}] ${platform} responded HTTP ${resp ? resp.status() : "?"} — browser is yours.`)
} catch (e) {
  console.log(`[profile ${id}] platform nav error: ${e.message}`)
}

console.log(`[profile ${id}] ready. Close the window when done.`)

// Closing the window ends this process; the manager flips status back to idle.
context.on("close", () => process.exit(0))
