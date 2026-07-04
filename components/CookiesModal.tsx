"use client"

import { useEffect, useState } from "react"
import { Check, Trash2 } from "lucide-react"
import { platformColor, platformLabel } from "@/lib/platforms"

const PLACEHOLDER = `Paste this account's cookies, e.g.

{
  "sessionid": "...",
  "csrftoken": "...",
  "ds_user_id": "..."
}

— a { name: value } map, or a full cookie array export.`

export default function CookiesModal({
  account, onClose, onSaved,
}: {
  account: { id: number; username: string; platform: string }
  onClose: () => void
  onSaved: () => void
}) {
  const [have, setHave] = useState(false)
  const [text, setText] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const r = await fetch(`/api/accounts/${account.id}/cookies`, { cache: "no-store" })
    const d = await r.json()
    setHave(!!d.hasCookies)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  async function save() {
    setSaving(true); setMsg(null)
    const r = await fetch(`/api/accounts/${account.id}/cookies`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cookies: text }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setMsg({ ok: false, text: d.error || "Failed" }); return }
    setMsg({ ok: true, text: `Saved ${d.count} cookies — it'll launch logged in.` })
    setText(""); load(); onSaved()
  }
  async function clear() {
    await fetch(`/api/accounts/${account.id}/cookies`, { method: "DELETE" })
    load(); onSaved()
  }

  const accent = platformColor(account.platform)

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-head">
          <h2>Session · @{account.username}</h2>
          <p>Import this {platformLabel(account.platform)} account&rsquo;s cookies so it launches already logged in.</p>
        </div>
        <div className="modal-body">
          {have && (
            <div className="field">
              <label>Imported session</label>
              <span className="pchip" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
                <Check size={12} /> logged in
                <Trash2 size={12} style={{ cursor: "pointer", marginLeft: 2 }} onClick={clear} />
              </span>
            </div>
          )}
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
            {saving ? "Saving…" : "Save session"}
          </button>
        </div>
      </div>
    </div>
  )
}
