import { NextResponse } from "next/server"
import { stopProfile } from "@/lib/engine/manager"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const res = stopProfile(Number(params.id))
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
