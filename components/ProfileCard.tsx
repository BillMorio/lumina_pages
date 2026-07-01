"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Square, Trash2, Globe, Fingerprint, Clock, ChevronUp, Pencil, KeyRound } from "lucide-react"
import { PLATFORMS, platformColor, platformLabel } from "@/lib/platforms"

export type Profile = {
  id: number
  name: string
  niche: string | null
  platform: string
  fingerprint_preset: string
  proxy_server: string | null
  proxy_username?: string | null
  proxy_password?: string | null
  timezone_override: string | null
  status: string
  last_used_at: string | null
  running: boolean
  sessions?: string[]
}

function monogram(name: string) {
  const parts = name.replace(/[_.-]+/g, " ").trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase()
}
function timeAgo(iso: string | null) {
  if (!iso) return "never"
  // last_used_at is a full ISO string (…T…Z); created_at is SQLite "YYYY-MM-DD HH:MM:SS" (UTC).
  const norm = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z"
  const t = new Date(norm).getTime()
  if (Number.isNaN(t)) return "—"
  const d = (Date.now() - t) / 1000
  if (d < 45) return "just now"
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

export default function ProfileCard({
  p, busy, onLaunch, onStop, onDelete, onEdit, onCookies,
}: {
  p: Profile
  busy: boolean
  onLaunch: (id: number, platform: string) => void
  onStop: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (p: Profile) => void
  onCookies: (p: Profile) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const accent = platformColor(p.platform)
  const sessions = p.sessions ?? []

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  return (
    <div className="card">
      <div className="card-top">
        <div className="avatar" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}>
          {monogram(p.name)}
        </div>
        <div className="card-id">
          <div className="card-name">{p.name}</div>
          <div className="card-sub">{platformLabel(p.platform)}{p.niche ? ` · ${p.niche}` : ""}</div>
        </div>
        <span className={`status-pill ${p.running ? "running" : "idle"}`}>
          <span className={`dot ${p.running ? "live" : ""}`} />
          {p.running ? "Running" : "Idle"}
        </span>
      </div>

      <div className="meta-list">
        <div className="meta-row">
          <Globe className="ic" size={14} />
          <span className="k">Proxy</span>
          <span className={`v ${p.proxy_server ? "" : "warn"}`}>
            {p.proxy_server ? p.proxy_server.replace(/^https?:\/\//, "") : "home IP (no proxy)"}
          </span>
        </div>
        <div className="meta-row">
          <Fingerprint className="ic" size={14} />
          <span className="k">Fingerprint</span>
          <span className="v">{p.fingerprint_preset}{p.timezone_override ? ` · ${p.timezone_override.split("/").pop()}` : ""}</span>
        </div>
        <div className="meta-row">
          <KeyRound className="ic" size={14} />
          <span className="k">Sessions</span>
          <span className="v" style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
            {sessions.length === 0 ? <span style={{ color: "var(--text-3)" }}>none imported</span>
              : sessions.map((s) => <span key={s} className="pdot" title={s} style={{ background: platformColor(s), width: 9, height: 9 }} />)}
          </span>
        </div>
        <div className="meta-row">
          <Clock className="ic" size={14} />
          <span className="k">Last used</span>
          <span className="v">{timeAgo(p.last_used_at)}</span>
        </div>
      </div>

      <div className="card-actions">
        {p.running ? (
          <button className="btn danger sm" disabled={busy} onClick={() => onStop(p.id)}>
            <Square size={14} /> Stop
          </button>
        ) : (
          <div className="pop-wrap" ref={ref}>
            <button className="btn primary sm" disabled={busy} onClick={() => setOpen((o) => !o)}>
              <Play size={14} /> Launch <ChevronUp size={13} style={{ opacity: 0.8 }} />
            </button>
            {open && (
              <div className="popover">
                <div className="pop-title">Open which platform?</div>
                {PLATFORMS.map((pl) => (
                  <div key={pl.key} className="pop-item" onClick={() => { setOpen(false); onLaunch(p.id, pl.key) }}>
                    <span className="pdot" style={{ background: pl.color }} />
                    {pl.label}
                    {sessions.includes(pl.key) && <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--green)" }}>logged in</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="spacer" />
        <button className="btn icon sm" title="Sessions / cookies" disabled={busy} onClick={() => onCookies(p)}><KeyRound size={15} /></button>
        <button className="btn icon sm" title="Edit" disabled={busy || p.running} onClick={() => onEdit(p)}><Pencil size={15} /></button>
        <button className="btn icon sm danger" title="Delete" disabled={busy || p.running} onClick={() => onDelete(p.id)}><Trash2 size={15} /></button>
      </div>
    </div>
  )
}
