import type { Metadata } from "next"
import Sidebar from "@/components/Sidebar"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lumina Pages",
  description: "Local-first platform for running multiple social media accounts at scale.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  )
}
