import { NextResponse } from "next/server"
import { getProfile, updateProfile, deleteProfile } from "@/lib/engine/store"
import { isRunning, stopProfile } from "@/lib/engine/manager"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = getProfile(Number(params.id))
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ profile: { ...p, running: isRunning(p.id) } })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (isRunning(id)) return NextResponse.json({ error: "Stop the profile before editing it" }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const updated = updateProfile(id, {
    name: body.name,
    niche: body.niche,
    platform: body.platform,
    fingerprint_preset: body.fingerprint_preset,
    proxy_server: body.proxy_server,
    proxy_username: body.proxy_username,
    proxy_password: body.proxy_password,
    timezone_override: body.timezone_override,
    notes: body.notes,
  })
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ profile: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (isRunning(id)) stopProfile(id)
  const ok = deleteProfile(id)
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
