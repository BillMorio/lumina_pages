"use client"

import { useState } from "react"
import { PLATFORMS } from "@/lib/platforms"

const PRESETS = [
  { key: "us-win", label: "US · Windows (New York)" },
  { key: "us-mac", label: "US · Mac (New York)" },
  { key: "mx-win", label: "MX · Windows (Mexico City)" },
  { key: "gb-win", label: "UK · Windows (London)" },
]

const EMPTY = {
  name: "", niche: "", platform: "instagram", fingerprint_preset: "us-win",
  proxy_server: "", proxy_username: "", proxy_password: "",
}

export default function NewProfileModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm({ ...form, [k]: v })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    const r = await fetch("/api/profiles", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form),
    })
    setSaving(false)
    if (!r.ok) { setError((await r.json()).error || "Failed to create"); return }
    onCreated(); onClose()
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="modal-head">
            <h2>New profile</h2>
            <p>One profile = one account identity, pinned to a fingerprint + proxy for life.</p>
          </div>
          <div className="modal-body">
            {error && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div className="field row2">
              <div>
                <label>Name / handle</label>
                <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="caliente_clips_01" required />
              </div>
              <div>
                <label>Niche / label</label>
                <input value={form.niche} onChange={(e) => set("niche", e.target.value)} placeholder="casino UGC" />
              </div>
            </div>
            <div className="field row2">
              <div>
                <label>Primary platform</label>
                <select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
                  {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label>Fingerprint / identity</label>
                <select value={form.fingerprint_preset} onChange={(e) => set("fingerprint_preset", e.target.value)}>
                  {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Proxy server <span style={{ color: "var(--text-3)" }}>· http://host:port (blank = home IP)</span></label>
              <input value={form.proxy_server} onChange={(e) => set("proxy_server", e.target.value)} placeholder="http://204.0.11.89:443" />
            </div>
            <div className="field row2">
              <div>
                <label>Proxy username</label>
                <input value={form.proxy_username} onChange={(e) => set("proxy_username", e.target.value)} />
              </div>
              <div>
                <label>Proxy password</label>
                <input value={form.proxy_password} onChange={(e) => set("proxy_password", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving || !form.name.trim()}>
              {saving ? "Creating…" : "Create profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
