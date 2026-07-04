import { NextResponse } from "next/server"
import { login } from "@/lib/engine/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const res = await login(String(body?.username || ""), String(body?.password || ""))
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 401 })
  return NextResponse.json({ user: res.user })
}
