import { NextResponse } from "next/server"
import { getProfile } from "@/lib/engine/store"
import { setCookies, deleteCookies, platformsWithCookies } from "@/lib/engine/cookies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!getProfile(id)) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ platforms: platformsWithCookies(id) })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!getProfile(id)) return NextResponse.json({ error: "not found" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const platform = String(body?.platform || "")
  if (!platform) return NextResponse.json({ error: "platform is required" }, { status: 400 })

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

  setCookies(id, platform, cookies)
  return NextResponse.json({ ok: true, platform, count })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const platform = new URL(req.url).searchParams.get("platform") || ""
  if (!platform) return NextResponse.json({ error: "platform query param required" }, { status: 400 })
  deleteCookies(id, platform)
  return NextResponse.json({ ok: true })
}
