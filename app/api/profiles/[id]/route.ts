import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { getProfile, updateProfile, deleteProfile, listAccounts, logActivity } from "@/lib/engine/store"
import { isRunning, stopAccount } from "@/lib/engine/manager"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const p = await getProfile(Number(params.id))
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 })
  const accounts = await Promise.all((await listAccounts(p.id)).map(async (a) => ({ ...a, running: await isRunning(a.id) })))
  return NextResponse.json({ profile: { ...p, accounts } })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  const runningFlags = await Promise.all((await listAccounts(id)).map((a) => isRunning(a.id)))
  if (runningFlags.some(Boolean)) {
    return NextResponse.json({ error: "Stop this profile's accounts before editing it" }, { status: 409 })
  }
  const body = await req.json().catch(() => ({}))
  const updated = await updateProfile(id, {
    name: body.name,
    niche: body.niche,
    fingerprint_preset: body.fingerprint_preset,
    proxy_server: body.proxy_server,
    proxy_username: body.proxy_username,
    proxy_password: body.proxy_password,
    timezone_override: body.timezone_override,
    notes: body.notes,
  })
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  await logActivity(user.id, "profile.update", "profile", id, { name: updated.name })
  return NextResponse.json({ profile: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  const p = await getProfile(id)
  for (const a of await listAccounts(id)) if (await isRunning(a.id)) await stopAccount(a.id)
  const ok = await deleteProfile(id)
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
  await logActivity(user.id, "profile.delete", "profile", id, { name: p?.name })
  return NextResponse.json({ ok: true })
}
