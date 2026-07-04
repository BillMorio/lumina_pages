import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { getAccount, getProfile, logActivity } from "@/lib/engine/store"
import { stopAccount } from "@/lib/engine/manager"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  // last_used_at was stamped with the launch time by launchAccount() and isn't
  // touched again until this stop — read it first so we can log how long the
  // browser session ran.
  const before = await getAccount(id)
  const profile = before ? await getProfile(before.profile_id) : undefined
  const launchedAt = before?.last_used_at ? new Date(before.last_used_at).getTime() : null

  const res = await stopAccount(id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })

  const durationSeconds = launchedAt ? Math.round((Date.now() - launchedAt) / 1000) : null
  await logActivity(user.id, "account.stop", "account", id, {
    username: before?.username, platform: before?.platform, profileName: profile?.name, durationSeconds,
  })
  return NextResponse.json({ ok: true })
}
