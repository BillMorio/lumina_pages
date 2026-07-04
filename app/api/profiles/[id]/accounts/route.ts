import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { getProfile, createAccount, countAccountsForPlatform, logActivity } from "@/lib/engine/store"
import { MAX_ACCOUNTS_PER_PLATFORM, platformLabel } from "@/lib/platforms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const profileId = Number(params.id)
  if (!(await getProfile(profileId))) return NextResponse.json({ error: "profile not found" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  if (!body?.username || typeof body.username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }
  if (!body?.platform || typeof body.platform !== "string") {
    return NextResponse.json({ error: "platform is required" }, { status: 400 })
  }
  if ((await countAccountsForPlatform(profileId, body.platform)) >= MAX_ACCOUNTS_PER_PLATFORM) {
    return NextResponse.json(
      { error: `Max ${MAX_ACCOUNTS_PER_PLATFORM} ${platformLabel(body.platform)} accounts on one IP` },
      { status: 400 },
    )
  }
  const account = await createAccount(profileId, {
    platform: body.platform,
    username: body.username.trim(),
    password: body.password ?? null,
    email: body.email ?? null,
    twofa: body.twofa ?? null,
    notes: body.notes ?? null,
  })
  await logActivity(user.id, "account.create", "account", account.id, { username: account.username, platform: account.platform })
  return NextResponse.json({ account }, { status: 201 })
}
