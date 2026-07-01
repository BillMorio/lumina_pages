"use client"

import { Users, Flame, Send, FolderOpen, Calendar, BarChart3, Globe, Settings } from "lucide-react"

const NAV = [
  { key: "profiles", label: "Profiles", icon: Users, active: true },
]

const SOON = [
  { key: "warmup", label: "Warm-up", icon: Flame },
  { key: "posting", label: "Posting", icon: Send },
  { key: "content", label: "Content", icon: FolderOpen },
  { key: "schedule", label: "Schedule", icon: Calendar },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "proxies", label: "Proxies", icon: Globe },
]

export default function Sidebar() {
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
        <div key={n.key} className={`nav-item ${n.active ? "active" : ""}`}>
          <n.icon size={17} />
          {n.label}
        </div>
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
        <div className="nav-item soon" style={{ padding: "8px 10px", marginBottom: 6 }}>
          <Settings size={17} />
          Settings
          <span className="soon-tag">SOON</span>
        </div>
        v0.1 · local
      </div>
    </aside>
  )
}
