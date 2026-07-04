import { NextResponse } from "next/server"
import { setupRequired } from "@/lib/engine/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ setupRequired: await setupRequired() })
}
