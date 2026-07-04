import { NextResponse } from "next/server"
import { register, login, currentUser, setupRequired } from "@/lib/engine/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Open only for the very first (bootstrap admin) account. After that, only an
// already-logged-in admin can add teammates.
export async function POST(req: Request) {
  const bootstrap = await setupRequired()
  if (!bootstrap) {
    const me = await currentUser()
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Only an admin can add new operators" }, { status: 403 })
    }
  }
  const body = await req.json().catch(() => ({}))
  const res = await register(String(body?.username || ""), String(body?.password || ""))
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  if (bootstrap) await login(res.user.username, String(body?.password || "")) // auto-login the first admin
  return NextResponse.json({ user: res.user }, { status: 201 })
}
