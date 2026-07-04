import { NextResponse } from "next/server"
import { currentUser } from "@/lib/engine/auth"
import { getAccount, logActivity } from "@/lib/engine/store"
import { setCookies, deleteCookies, hasCookies } from "@/lib/engine/cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  if (!(await getAccount(id))) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ hasCookies: hasCookies(id) })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  const account = await getAccount(id)
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 })
  const body = await req.json().catch(() => ({}))

  let cookies = body?.cookies
  if (typeof cookies === "string") {
    try {
      cookies = JSON.parse(cookies)
    } catch {
      return NextResponse.json({ error: "Cookies must be valid JSON (a { name: value } object or a cookie array)" }, { status: 400 })
    }
  }
  if (!cookies || typeof cookies !== "object") {
    return NextResponse.json({ error: "Cookies must be a JSON object or array" }, { status: 400 })
  }
  const count = Array.isArray(cookies) ? cookies.length : Object.keys(cookies).filter((k) => k !== "_comment").length
  if (count === 0) return NextResponse.json({ error: "No cookies found in the pasted JSON" }, { status: 400 })

  setCookies(id, cookies)
  await logActivity(user.id, "account.cookies_import", "account", id, { username: account.username, count })
  return NextResponse.json({ ok: true, count })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 })
  const id = Number(params.id)
  const account = await getAccount(id)
  deleteCookies(id)
  await logActivity(user.id, "account.cookies_clear", "account", id, { username: account?.username })
  return NextResponse.json({ ok: true })
}
