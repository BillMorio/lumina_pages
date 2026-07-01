import { NextResponse } from "next/server"
import { FINGERPRINTS } from "@/lib/engine/fingerprints"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    presets: Object.entries(FINGERPRINTS).map(([key, fp]) => ({
      key,
      locale: fp.locale,
      timezoneId: fp.timezoneId,
      platform: fp.platform,
    })),
  })
}
