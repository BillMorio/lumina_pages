"use client"

import { useState } from "react"
import { PLATFORMS } from "@/lib/platforms"

const PRESETS = [
  { key: "us-win", label: "US · Windows (New York)" },
  { key: "us-mac", label: "US · Mac (New York)" },
  { key: "mx-win", label: "MX · Windows (Mexico City)" },
  { key: "gb-win", label: "UK · Windows (London)" },
]

export type EditProfile = {
  id: number; name: string; niche: string | null; platform: string
  fingerprint_preset: string; proxy_server: string | null
  proxy_username?: string | null; proxy_password?: string | null
}

export default function ProfileModal({
  profile, onClose, onSaved,
}: {
  profile?: EditProfile | null
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!profile
  const [form, setForm] = useState({
    name: profile?.name ?? "",
    niche: profile?.niche ?? "",
    platform: profile?.platform ?? "instagram",
    fingerprint_preset: profile?.fingerprint_preset ?? "us-win",
    proxy_server: profile?.proxy_server ?? "",
    proxy_username: profile?.proxy_username ?? "",
    proxy_password: profile?.proxy_password ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm({ ...form, [k]: v })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    const r = await fetch(editing ? `/api/profiles/${profile!.id}` : "/api/profiles", {
      method: editing ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!r.ok) { setError((await r.json()).error || "Failed to save"); return }
    onSaved(); onClose()
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="modal-head">
            <h2>{editing ? "Edit profile" : "New profile"}</h2>
            <p>One profile = one account identity, pinned to a fingerprint + proxy.</p>
          </div>
          <div className="modal-body">
            {error && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div className="field row2">
              <div><label>Name / handle</label><input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="caliente_clips_01" required /></div>
              <div><label>Niche / label</label><input value={form.niche} onChange={(e) => set("niche", e.target.value)} placeholder="casino UGC" /></div>
            </div>
            <div className="field row2">
              <div><label>Primary platform</label><select value={form.platform} onChange={(e) => set("platform", e.target.value)}>{PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
              <div><label>Fingerprint / identity</label><select value={form.fingerprint_preset} onChange={(e) => set("fingerprint_preset", e.target.value)}>{PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
            </div>
            <div className="field">
              <label>Proxy server <span style={{ color: "var(--text-3)" }}>· http://host:port (blank = home IP)</span></label>
              <input value={form.proxy_server} onChange={(e) => set("proxy_server", e.target.value)} placeholder="http://204.0.11.89:443" />
            </div>
            <div className="field row2">
              <div><label>Proxy username</label><input value={form.proxy_username} onChange={(e) => set("proxy_username", e.target.value)} /></div>
              <div><label>Proxy password</label><input value={form.proxy_password} onChange={(e) => set("proxy_password", e.target.value)} /></div>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
