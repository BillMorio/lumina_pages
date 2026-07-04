import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { getAccount, updateAccount, deleteAccount, logActivity } from "@/lib/engine/store"
import { isRunning, stopAccount } from "@/lib/engine/manager"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const a = await getAccount(Number(params.id))
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ account: { ...a, running: await isRunning(a.id) } })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  if (await isRunning(id)) return NextResponse.json({ error: "Stop the account before editing it" }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const updated = await updateAccount(id, {
    platform: body.platform,
    username: body.username,
    password: body.password,
    email: body.email,
    twofa: body.twofa,
    notes: body.notes,
  })
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
  await logActivity(user.id, "account.update", "account", id, { username: updated.username })
  return NextResponse.json({ account: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  const a = await getAccount(id)
  if (await isRunning(id)) await stopAccount(id)
  const ok = await deleteAccount(id)
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
  await logActivity(user.id, "account.delete", "account", id, { username: a?.username })
  return NextResponse.json({ ok: true })
}
