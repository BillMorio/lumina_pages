"use client"

import { useState } from "react"
import { PLATFORMS, MAX_ACCOUNTS_PER_PLATFORM } from "@/lib/platforms"

export type EditAccount = {
  id: number; profile_id: number; platform: string; username: string
  password?: string | null; email?: string | null; twofa?: string | null; notes?: string | null
}

export default function AccountModal({
  profile, account, existingAccounts, onClose, onSaved,
}: {
  profile: { id: number; name: string }
  account?: EditAccount | null
  existingAccounts: { platform: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!account
  const countByPlatform = (key: string) => existingAccounts.filter((a) => a.platform === key).length
  const firstOpenPlatform = PLATFORMS.find((p) => countByPlatform(p.key) < MAX_ACCOUNTS_PER_PLATFORM)?.key ?? PLATFORMS[0].key
  const [form, setForm] = useState({
    platform: account?.platform ?? firstOpenPlatform,
    username: account?.username ?? "",
    password: account?.password ?? "",
    email: account?.email ?? "",
    twofa: account?.twofa ?? "",
    notes: account?.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm({ ...form, [k]: v })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    const r = await fetch(editing ? `/api/accounts/${account!.id}` : `/api/profiles/${profile.id}/accounts`, {
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
            <h2>{editing ? "Edit account" : "New account"}</h2>
            <p>A login riding on <b>{profile.name}</b>&rsquo;s proxy + fingerprint.</p>
          </div>
          <div className="modal-body">
            {error && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div className="field row2">
              <div>
                <label>Platform</label>
                <select value={form.platform} onChange={(e) => set("platform", e.target.value)} disabled={editing}>
                  {PLATFORMS.map((p) => {
                    const full = !editing && countByPlatform(p.key) >= MAX_ACCOUNTS_PER_PLATFORM
                    return (
                      <option key={p.key} value={p.key} disabled={full}>
                        {p.label}{full ? ` (${MAX_ACCOUNTS_PER_PLATFORM}/${MAX_ACCOUNTS_PER_PLATFORM} max)` : ""}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div><label>Username / handle</label><input autoFocus value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="caliente_clips_01" required /></div>
            </div>
            <div className="field row2">
              <div><label>Password</label><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></div>
              <div><label>Recovery email</label><input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
            <div className="field row2">
              <div><label>2FA</label><input value={form.twofa} onChange={(e) => set("twofa", e.target.value)} placeholder="Secret key or backup codes" /></div>
              <div><label>Notes</label><input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ban history, etc." /></div>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving || !form.username.trim()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
