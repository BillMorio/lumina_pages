import { NextResponse } from "next/server"
import { listProfiles, createProfile } from "@/lib/engine/store"
import { runningIds } from "@/lib/engine/manager"
import { platformsWithCookies } from "@/lib/engine/cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const live = new Set(runningIds())
  const profiles = listProfiles().map((p) => ({
    ...p,
    running: live.has(p.id),
    sessions: platformsWithCookies(p.id),
  }))
  return NextResponse.json({ profiles })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  const profile = createProfile({
    name: body.name.trim(),
    niche: body.niche ?? null,
    platform: body.platform ?? "instagram",
    fingerprint_preset: body.fingerprint_preset ?? "us-win",
    proxy_server: body.proxy_server ?? null,
    proxy_username: body.proxy_username ?? null,
    proxy_password: body.proxy_password ?? null,
    timezone_override: body.timezone_override ?? null,
    notes: body.notes ?? null,
  })
  return NextResponse.json({ profile }, { status: 201 })
}
