// Per-profile identity presets. Each preset is a COHERENT bundle: the userAgent
// platform, locale, and timezone all agree (a "US Windows box in New York", a
// "MX Windows box in Mexico City"). Never mix — an es-MX locale on an
// America/New_York timezone is itself a detection tell. IG/FB flag *change* and
// *incoherence*, not any single value.
//
// Ported from the validated burner tooling. A profile pins one preset + one
// proxy for its entire life so the account is always the SAME device from the
// SAME residential IP/geo.

export type Fingerprint = {
  userAgent: string
  viewport: { width: number; height: number }
  deviceScaleFactor: number
  locale: string
  timezoneId: string
  platform: string
}

export const FINGERPRINTS: Record<string, Fingerprint> = {
  "us-win": {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1.25,
    locale: "en-US",
    timezoneId: "America/New_York",
    platform: "Win32",
  },
  "us-mac": {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    locale: "en-US",
    timezoneId: "America/New_York",
    platform: "MacIntel",
  },
  "mx-win": {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    platform: "Win32",
  },
  "gb-win": {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    locale: "en-GB",
    timezoneId: "Europe/London",
    platform: "Win32",
  },
}

export const FINGERPRINT_PRESETS = Object.keys(FINGERPRINTS)

export function resolveFingerprint(preset: string): Fingerprint {
  const fp = FINGERPRINTS[preset]
  if (!fp) throw new Error(`unknown fingerprint preset "${preset}" — known: ${FINGERPRINT_PRESETS.join(", ")}`)
  return fp
}
