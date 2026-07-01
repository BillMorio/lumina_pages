"use client"

import { useEffect, useState } from "react"
import { Check, Trash2 } from "lucide-react"
import { PLATFORMS, platformColor } from "@/lib/platforms"

const PLACEHOLDER = `Paste the account's cookies for this platform, e.g.

{
  "sessionid": "...",
  "csrftoken": "...",
  "ds_user_id": "..."
}

— a { name: value } map, or a full cookie array export.`

export default function CookiesModal({
  profile, onClose, onSaved,
}: {
  profile: { id: number; name: string }
  onClose: () => void
  onSaved: () => void
}) {
  const [have, setHave] = useState<string[]>([])
  const [platform, setPlatform] = useState("instagram")
  const [text, setText] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const r = await fetch(`/api/profiles/${profile.id}/cookies`, { cache: "no-store" })
    const d = await r.json()
    setHave(d.platforms || [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function save() {
    setSaving(true); setMsg(null)
    const r = await fetch(`/api/profiles/${profile.id}/cookies`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ platform, cookies: text }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setMsg({ ok: false, text: d.error || "Failed" }); return }
    setMsg({ ok: true, text: `Saved ${d.count} cookies for ${platform} — it'll launch logged in.` })
    setText(""); load(); onSaved()
  }
  async function clear(pl: string) {
    await fetch(`/api/profiles/${profile.id}/cookies?platform=${pl}`, { method: "DELETE" })
    load(); onSaved()
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-head">
          <h2>Sessions · {profile.name}</h2>
          <p>Import a warmed account's cookies per platform so this profile launches already logged in.</p>
        </div>
        <div className="modal-body">
          {have.length > 0 && (
            <div className="field">
              <label>Imported sessions</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {have.map((pl) => (
                  <span key={pl} className="pchip" style={{ background: `${platformColor(pl)}22`, color: platformColor(pl), border: `1px solid ${platformColor(pl)}55` }}>
                    <Check size={12} /> {pl}
                    <Trash2 size={12} style={{ cursor: "pointer", marginLeft: 2 }} onClick={() => clear(pl)} />
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="field row2">
            <div>
              <label>Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}{have.includes(p.key) ? "  ✓" : ""}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Cookies JSON</label>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER}
              style={{ width: "100%", minHeight: 170, background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 12.5, resize: "vertical" }}
            />
          </div>
          {msg && <div style={{ color: msg.ok ? "var(--green)" : "var(--red)", fontSize: 13 }}>{msg.text}</div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Done</button>
          <button type="button" className="btn primary" disabled={saving || !text.trim()} onClick={save}>
            {saving ? "Saving…" : `Save ${platform} session`}
          </button>
        </div>
      </div>
    </div>
  )
}
