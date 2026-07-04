import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lumina Pages",
  description: "Local-first platform for running multiple social media accounts at scale.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
