"use client"

import { Play, Square, Trash2, Globe, Fingerprint, Pencil, KeyRound, Plus, AlertTriangle } from "lucide-react"
import PlatformIcon from "./PlatformIcon"
import { PLATFORMS, MAX_ACCOUNTS_PER_PLATFORM, platformColor } from "@/lib/platforms"

export type AccountView = {
  id: number
  profile_id: number
  platform: string
  username: string
  password?: string | null
  email?: string | null
  twofa?: string | null
  notes?: string | null
  status: string
  last_used_at: string | null
  running: boolean
  hasCookies: boolean
}

export type Profile = {
  id: number
  name: string
  niche: string | null
  fingerprint_preset: string
  proxy_server: string | null
  proxy_username?: string | null
  proxy_password?: string | null
  timezone_override: string | null
  accounts: AccountView[]
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
  p, busy, onLaunchAccount, onStopAccount, onDeleteAccount, onEditAccount, onAccountCookies, onAddAccount, onEditProfile, onDeleteProfile,
}: {
  p: Profile
  busy: boolean
  onLaunchAccount: (accountId: number) => void
  onStopAccount: (accountId: number) => void
  onDeleteAccount: (a: AccountView) => void
  onEditAccount: (a: AccountView) => void
  onAccountCookies: (a: AccountView) => void
  onAddAccount: (p: Profile) => void
  onEditProfile: (p: Profile) => void
  onDeleteProfile: (p: Profile) => void
}) {
  const accounts = p.accounts ?? []
  const runningCount = accounts.filter((a) => a.running).length
  const groups = PLATFORMS.map((pl) => ({ platform: pl, accounts: accounts.filter((a) => a.platform === pl.key) })).filter((g) => g.accounts.length > 0)
  const atFullCapacity = groups.length > 0 && groups.every((g) => g.accounts.length >= MAX_ACCOUNTS_PER_PLATFORM)

  return (
    <div className="cluster">
      <div className="cluster-head">
        <div className="avatar cluster-avatar" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hi))" }}>
          {monogram(p.name)}
        </div>
        <div className="cluster-id">
          <div className="cluster-name">
            {p.name}
            {p.niche && <span className="cluster-niche"> · {p.niche}</span>}
          </div>
          <div className="cluster-meta">
            <span className={p.proxy_server ? "" : "warn"}>
              <Globe size={12} /> {p.proxy_server ? p.proxy_server.replace(/^https?:\/\//, "") : "home IP (no proxy)"}
            </span>
            <span>
              <Fingerprint size={12} /> {p.fingerprint_preset}{p.timezone_override ? ` · ${p.timezone_override.split("/").pop()}` : ""}
            </span>
          </div>
        </div>
        {accounts.length > 1 && (
          <span className="cluster-warn" title="Platforms can link accounts that share an IP or fingerprint, even with separate sessions.">
            <AlertTriangle size={12} /> {accounts.length} accounts on 1 IP
          </span>
        )}
        <div className="cluster-actions">
          <button className="btn icon sm" title="Edit profile" disabled={busy} onClick={() => onEditProfile(p)}><Pencil size={14} /></button>
          <button className="btn icon sm danger" title="Delete profile" disabled={busy || runningCount > 0} onClick={() => onDeleteProfile(p)}><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="cluster-body">
        {groups.length === 0 && <div className="acct-empty">No accounts linked to this IP yet</div>}
        {groups.map((g) => (
          <div key={g.platform.key} className="platform-group">
            <div className="platform-group-head">
              <PlatformIcon platform={g.platform.key} size={13} />
              {g.platform.label}
              <span className={`platform-count ${g.accounts.length >= MAX_ACCOUNTS_PER_PLATFORM ? "full" : ""}`}>
                {g.accounts.length}/{MAX_ACCOUNTS_PER_PLATFORM}
              </span>
            </div>
            <div className="acct-grid">
              {g.accounts.map((a) => (
                <AccountCard
                  key={a.id} a={a} busy={busy}
                  onLaunch={() => onLaunchAccount(a.id)}
                  onStop={() => onStopAccount(a.id)}
                  onDelete={() => onDeleteAccount(a)}
                  onEdit={() => onEditAccount(a)}
                  onCookies={() => onAccountCookies(a)}
                />
              ))}
            </div>
          </div>
        ))}
        {!atFullCapacity && (
          <button className="acct-card-add" disabled={busy} onClick={() => onAddAccount(p)}>
            <Plus size={16} />
            <span>Add account</span>
          </button>
        )}
      </div>
    </div>
  )
}

function AccountCard({
  a, busy, onLaunch, onStop, onDelete, onEdit, onCookies,
}: {
  a: AccountView
  busy: boolean
  onLaunch: () => void
  onStop: () => void
  onDelete: () => void
  onEdit: () => void
  onCookies: () => void
}) {
  const accent = platformColor(a.platform)

  return (
    <div className="acct-card">
      <div className="acct-card-top">
        <div className="acct-avatar" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}>
          {monogram(a.username)}
        </div>
        <div className="acct-card-id">
          <div className="acct-card-user" title={`@${a.username}`}>@{a.username}</div>
          <div className="acct-card-sub">
            {a.hasCookies && <span className="acct-logged-in" title="Session imported">● session</span>}
            {!a.hasCookies && <span>{a.running ? "running" : `used ${timeAgo(a.last_used_at)}`}</span>}
          </div>
        </div>
        <span className={`status-pill xs ${a.running ? "running" : "idle"}`} title={a.running ? "Running" : "Idle"}>
          <span className={`dot ${a.running ? "live" : ""}`} />
        </span>
      </div>
      <div className="acct-card-actions">
        {a.running ? (
          <button className="btn danger sm" disabled={busy} onClick={onStop}><Square size={12} /> Stop</button>
        ) : (
          <button className="btn primary sm" disabled={busy} onClick={onLaunch}><Play size={12} /> Launch</button>
        )}
      </div>
      <div className="acct-card-icons">
        <button className="btn icon xs" title="Session / cookies" disabled={busy} onClick={onCookies}><KeyRound size={12} /></button>
        <button className="btn icon xs" title="Edit account" disabled={busy || a.running} onClick={onEdit}><Pencil size={12} /></button>
        <button className="btn icon xs danger" title="Delete account" disabled={busy || a.running} onClick={onDelete}><Trash2 size={12} /></button>
      </div>
    </div>
  )
}
