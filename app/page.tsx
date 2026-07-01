"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Users } from "lucide-react"
import ProfileCard, { type Profile } from "@/components/ProfileCard"
import ProfileModal, { type EditProfile } from "@/components/ProfileModal"
import CookiesModal from "@/components/CookiesModal"

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editing, setEditing] = useState<EditProfile | null | undefined>(undefined) // undefined=closed, null=create, obj=edit
  const [cookiesFor, setCookiesFor] = useState<Profile | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch("/api/profiles", { cache: "no-store" })
    const d = await r.json()
    setProfiles(d.profiles || [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

  const flash = (msg: string) => { setError(msg); setTimeout(() => setError(null), 3500) }

  async function launch(id: number, platform: string) {
    setBusy(id)
    const r = await fetch(`/api/profiles/${id}/launch`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform }),
    })
    if (!r.ok) flash((await r.json()).error || "Launch failed")
    setBusy(null); load()
  }
  async function stop(id: number) {
    setBusy(id)
    const r = await fetch(`/api/profiles/${id}/stop`, { method: "POST" })
    if (!r.ok) flash((await r.json()).error || "Stop failed")
    setBusy(null); load()
  }
  async function remove(id: number) {
    if (!confirm("Delete this profile? Its saved session will be removed.")) return
    setBusy(id)
    await fetch(`/api/profiles/${id}`, { method: "DELETE" })
    setBusy(null); load()
  }

  const running = profiles.filter((p) => p.running).length

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Profiles</h1>
          <div className="subtitle">Create, warm, and run your account identities — each on its own stealth fingerprint + proxy.</div>
        </div>
        <button className="btn primary" onClick={() => setEditing(null)}>
          <Plus size={16} /> New profile
        </button>
      </div>

      <div className="content">
        {loaded && profiles.length > 0 && (
          <div className="stat-row">
            <div className="stat"><b>{profiles.length}</b> {profiles.length === 1 ? "profile" : "profiles"}</div>
            <div className="stat"><b>{running}</b> running</div>
          </div>
        )}

        {loaded && profiles.length === 0 ? (
          <div className="empty">
            <Users className="ic" size={34} />
            <h3>No profiles yet</h3>
            <p style={{ maxWidth: 360, margin: "0 auto 18px" }}>
              A profile is one account identity — a stealth browser pinned to a fingerprint and proxy, with its own persistent session.
            </p>
            <button className="btn primary" onClick={() => setEditing(null)}><Plus size={16} /> Create your first profile</button>
          </div>
        ) : (
          <div className="grid">
            {profiles.map((p) => (
              <ProfileCard
                key={p.id} p={p} busy={busy === p.id}
                onLaunch={launch} onStop={stop} onDelete={remove}
                onEdit={(pr) => setEditing(pr as EditProfile)}
                onCookies={(pr) => setCookiesFor(pr)}
              />
            ))}
          </div>
        )}
      </div>

      {editing !== undefined && (
        <ProfileModal profile={editing} onClose={() => setEditing(undefined)} onSaved={load} />
      )}
      {cookiesFor && (
        <CookiesModal profile={cookiesFor} onClose={() => setCookiesFor(null)} onSaved={load} />
      )}
      {error && <div className="toast">{error}</div>}
    </>
  )
}
