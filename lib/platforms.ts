// Platform metadata shared across the UI. A profile is a browser identity that
// can hold logins for several platforms — you pick which one to open at launch.
export type PlatformKey = "instagram" | "facebook" | "tiktok" | "twitter" | "youtube"

export const PLATFORMS: { key: PlatformKey; label: string; color: string }[] = [
  { key: "instagram", label: "Instagram", color: "#e1306c" },
  { key: "facebook", label: "Facebook", color: "#1877f2" },
  { key: "tiktok", label: "TikTok", color: "#ff2d55" },
  { key: "twitter", label: "X / Twitter", color: "#1d9bf0" },
  { key: "youtube", label: "YouTube", color: "#ff0000" },
]

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.key, p])) as Record<PlatformKey, (typeof PLATFORMS)[number]>

// A platform gets "linked" by the host app once too many of its accounts share
// one IP/fingerprint — cap accounts per platform per profile, not just total.
export const MAX_ACCOUNTS_PER_PLATFORM = 3

export function platformColor(key: string): string {
  return PLATFORM_MAP[key as PlatformKey]?.color ?? "#6366f1"
}
export function platformLabel(key: string): string {
  return PLATFORM_MAP[key as PlatformKey]?.label ?? key
}
