"use client"

import { useEffect, useState, useCallback } from "react"

type Profile = {
  id: number
  name: string
  niche: string | null
  platform: string
  fingerprint_preset: string
  proxy_server: string | null
  proxy_username: string | null
  proxy_password: string | null
  timezone_override: string | null
  notes: string | null
  status: string
  last_used_at: string | null
  running: boolean
}

const PLATFORMS = ["instagram", "facebook", "tiktok", "twitter", "youtube"]
const PRESETS = ["us-win", "us-mac", "mx-win", "gb-win"]

const EMPTY = {
  name: "", niche: "", platform: "instagram", fingerprint_preset: "us-win",
  proxy_server: "", proxy_username: "", proxy_password: "", notes: "",
}

export default function Dashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [form, setForm] = useState({ ...EMPTY })
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch("/api/profiles", { cache: "no-store" })
    const d = await r.json()
    setProfiles(d.profiles || [])
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 3000) // live status polling
    return () => clearInterval(t)
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const r = await fetch("/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!r.ok) { setError((await r.json()).error || "failed"); return }
    setForm({ ...EMPTY }); setShowForm(false); load()
  }

  async function act(id: number, action: "launch" | "stop") {
    setBusy(id); setError(null)
    const r = await fetch(`/api/profiles/${id}/${action}`, { method: "POST" })
    if (!r.ok) setError((await r.json()).error || "failed")
    setBusy(null); load()
  }

  async function remove(id: number) {
    if (!confirm("Delete this profile? Its saved session will be removed.")) return
    setBusy(id)
    await fetch(`/api/profiles/${id}`, { method: "DELETE" })
    setBusy(null); load()
  }

  return (
    <div className="wrap">
      <div className="header">
        <h1>Lumina Pages</h1>
        <button className="primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ New profile"}</button>
      </div>
      <p className="sub">Create, warm, and run multiple social accounts — each on its own stealth identity + proxy.</p>

      {error && <div className="panel" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</div>}

      {showForm && (
        <form className="panel" onSubmit={create}>
          <h2>New profile</h2>
          <p className="muted" style={{ margin: "0 0 8px" }}>One profile = one account identity, pinned to a fingerprint + proxy for life.</p>
          <div className="form-grid">
            <div><label>Name / handle</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. caliente_clips_01" required /></div>
            <div><label>Niche / label</label><input value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} placeholder="e.g. casino UGC" /></div>
            <div><label>Platform</label><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label>Fingerprint preset</label><select value={form.fingerprint_preset} onChange={(e) => setForm({ ...form, fingerprint_preset: e.target.value })}>{PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label>Proxy server (http://host:port)</label><input value={form.proxy_server} onChange={(e) => setForm({ ...form, proxy_server: e.target.value })} placeholder="http://204.0.11.89:443" /></div>
            <div><label>Proxy username</label><input value={form.proxy_username} onChange={(e) => setForm({ ...form, proxy_username: e.target.value })} /></div>
            <div><label>Proxy password</label><input value={form.proxy_password} onChange={(e) => setForm({ ...form, proxy_password: e.target.value })} /></div>
            <div><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="right"><button className="primary" type="submit">Create profile</button></div>
        </form>
      )}

      {profiles.length === 0 ? (
        <div className="empty">No profiles yet. Click <b>+ New profile</b> to create your first account identity.</div>
      ) : (
        <div className="grid">
          {profiles.map((p) => (
            <div className="card" key={p.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>{p.name}</h3>
                <span className={`badge ${p.running ? "running" : "idle"}`}>{p.running ? "running" : "idle"}</span>
              </div>
              <div className="meta">{p.platform}{p.niche ? ` · ${p.niche}` : ""}</div>
              <div className="kv"><span>Fingerprint</span><span>{p.fingerprint_preset}</span></div>
              <div className="kv"><span>Proxy</span><span>{p.proxy_server ? p.proxy_server.replace(/^https?:\/\//, "") : "— home IP —"}</span></div>
              <div className="kv"><span>Last used</span><span>{p.last_used_at ? new Date(p.last_used_at).toLocaleString() : "never"}</span></div>
              <div className="right">
                {p.running
                  ? <button className="danger" disabled={busy === p.id} onClick={() => act(p.id, "stop")}>Stop</button>
                  : <button className="primary" disabled={busy === p.id} onClick={() => act(p.id, "launch")}>Launch</button>}
                <button className="danger" disabled={busy === p.id || p.running} onClick={() => remove(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
