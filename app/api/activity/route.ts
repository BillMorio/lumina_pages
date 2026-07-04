import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { listActivity, listAccountSessions } from "@/lib/engine/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const [activity, sessions] = await Promise.all([listActivity(200), listAccountSessions(200)])
  return NextResponse.json({ activity, sessions })
}
