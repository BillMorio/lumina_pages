"use client"

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Users, Flame, Send, FolderOpen, Calendar, BarChart3, Globe, Settings, ScrollText, LogOut } from "lucide-react"

const NAV = [
  { key: "profiles", label: "Profiles", icon: Users, href: "/" },
  { key: "activity", label: "Activity", icon: ScrollText, href: "/activity" },
]

const SOON = [
  { key: "warmup", label: "Warm-up", icon: Flame },
  { key: "posting", label: "Posting", icon: Send },
  { key: "content", label: "Content", icon: FolderOpen },
  { key: "schedule", label: "Schedule", icon: Calendar },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "proxies", label: "Proxies", icon: Globe },
]

function monogram(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export default function Sidebar({ user }: { user: { id: number; username: string; role: string } }) {
  const router = useRouter()
  const pathname = usePathname()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">L</div>
        <div className="brand-name">
          Lumina Pages
          <small>Account manager</small>
        </div>
      </div>

      <div className="nav-label">Manage</div>
      {NAV.map((n) => (
        <Link key={n.key} href={n.href} className={`nav-item ${pathname === n.href ? "active" : ""}`}>
          <n.icon size={17} />
          {n.label}
        </Link>
      ))}

      <div className="nav-label">Automation</div>
      {SOON.map((n) => (
        <div key={n.key} className="nav-item soon">
          <n.icon size={17} />
          {n.label}
          <span className="soon-tag">SOON</span>
        </div>
      ))}

      <div className="sidebar-foot">
        <div className="nav-item soon" style={{ padding: "8px 10px", marginBottom: 10 }}>
          <Settings size={17} />
          Settings
          <span className="soon-tag">SOON</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{monogram(user.username)}</div>
          <div className="sidebar-user-id">
            <div className="sidebar-user-name">{user.username}</div>
            <div className="sidebar-user-role">{user.role}</div>
          </div>
          <button className="btn icon xs" title="Log out" onClick={logout}><LogOut size={14} /></button>
        </div>
        v0.1 · local
      </div>
    </aside>
  )
}
