import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  return NextResponse.json({ user })
}
