import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { getAccount, getProfile, logActivity } from "@/lib/engine/store"
import { launchAccount } from "@/lib/engine/manager"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  const res = await launchAccount(id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  const account = await getAccount(id)
  const profile = account ? await getProfile(account.profile_id) : undefined
  await logActivity(user.id, "account.launch", "account", id, {
    username: account?.username, platform: account?.platform, profileName: profile?.name,
  })
  return NextResponse.json({ ok: true })
}
