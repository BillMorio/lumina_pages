"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/auth/status").then((r) => r.json()).then((d) => setSetupRequired(!!d.setupRequired))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    const endpoint = setupRequired ? "/api/auth/register" : "/api/auth/login"
    const r = await fetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    setSaving(false)
    if (!r.ok) { setError((await r.json()).error || "Failed"); return }
    router.push("/")
    router.refresh()
  }

  if (setupRequired === null) return null

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 22px", justifyContent: "center" }}>
          <div className="brand-mark">L</div>
          <div className="brand-name">
            Lumina Pages
            <small>Account manager</small>
          </div>
        </div>
        <h2 className="auth-title">{setupRequired ? "Create the admin account" : "Log in"}</h2>
        <p className="auth-sub">
          {setupRequired
            ? "No operators exist yet — the first account created here becomes the admin."
            : "Sign in to see and run your team's profiles."}
        </p>
        {error && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div className="field">
          <label>Username</label>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center", padding: "10px 14px" }} disabled={saving}>
          {saving ? "Please wait…" : setupRequired ? "Create account & log in" : "Log in"}
        </button>
      </form>
    </div>
  )
}
