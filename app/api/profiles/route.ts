import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { listProfiles, createProfile, listAccounts, logActivity } from "@/lib/engine/store"
import { runningIds } from "@/lib/engine/manager"
import { hasCookies } from "@/lib/engine/cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const live = new Set(await runningIds())
  const profiles = await Promise.all(
    (await listProfiles()).map(async (p) => ({
      ...p,
      accounts: (await listAccounts(p.id)).map((a) => ({
        ...a,
        running: live.has(a.id),
        hasCookies: hasCookies(a.id),
      })),
    })),
  )
  return NextResponse.json({ profiles })
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  const profile = await createProfile({
    name: body.name.trim(),
    niche: body.niche ?? null,
    fingerprint_preset: body.fingerprint_preset ?? "us-win",
    proxy_server: body.proxy_server ?? null,
    proxy_username: body.proxy_username ?? null,
    proxy_password: body.proxy_password ?? null,
    timezone_override: body.timezone_override ?? null,
    notes: body.notes ?? null,
  })
  await logActivity(user.id, "profile.create", "profile", profile.id, { name: profile.name })
  return NextResponse.json({ profile }, { status: 201 })
}
