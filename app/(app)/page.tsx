"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Plus, Users, Search, X } from "lucide-react"
import ProfileCard, { type Profile, type AccountView } from "@/components/ProfileCard"
import ProfileModal, { type EditProfile } from "@/components/ProfileModal"
import AccountModal, { type EditAccount } from "@/components/AccountModal"
import CookiesModal from "@/components/CookiesModal"
import ConfirmModal from "@/components/ConfirmModal"
import PlatformIcon from "@/components/PlatformIcon"
import { PLATFORMS, platformLabel } from "@/lib/platforms"

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editingProfile, setEditingProfile] = useState<EditProfile | null | undefined>(undefined) // undefined=closed, null=create, obj=edit
  const [accountModal, setAccountModal] = useState<{ profile: Profile; account: EditAccount | null } | null>(null)
  const [cookiesFor, setCookiesFor] = useState<AccountView | null>(null)
  const [confirming, setConfirming] = useState<{ title: string; body: string; run: () => void } | null>(null)
  const [busy, setBusy] = useState<number | null>(null) // profile id currently mid-action (disables its whole card)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState("")
  const [platformTab, setPlatformTab] = useState("all")
  const [connError, setConnError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/profiles", { cache: "no-store" })
      if (!r.ok) throw new Error(`Server responded ${r.status}`)
      const d = await r.json()
      setProfiles(d.profiles || [])
      setConnError(null)
    } catch (e) {
      // A failed poll used to fail silently — the page just looked blank or
      // frozen on stale data with no indication why. Surface it instead.
      setConnError("Can't reach the server or database right now. Check your internet connection, and check this app's Terminal window for errors.")
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

  const flash = (msg: string) => { setError(msg); setTimeout(() => setError(null), 3500) }

  async function launchAccount(profileId: number, accountId: number) {
    setBusy(profileId)
    const r = await fetch(`/api/accounts/${accountId}/launch`, { method: "POST" })
    if (!r.ok) flash((await r.json()).error || "Launch failed")
    setBusy(null); load()
  }
  async function stopAccount(profileId: number, accountId: number) {
    setBusy(profileId)
    const r = await fetch(`/api/accounts/${accountId}/stop`, { method: "POST" })
    if (!r.ok) flash((await r.json()).error || "Stop failed")
    setBusy(null); load()
  }
  function confirmDeleteAccount(profileId: number, a: AccountView) {
    setConfirming({
      title: `Delete @${a.username}?`,
      body: `This removes the ${platformLabel(a.platform)} account and its saved session from this profile. This can't be undone.`,
      run: async () => {
        setBusy(profileId)
        await fetch(`/api/accounts/${a.id}`, { method: "DELETE" })
        setBusy(null); load()
      },
    })
  }
  function confirmDeleteProfile(p: Profile) {
    const n = p.accounts?.length || 0
    setConfirming({
      title: `Delete ${p.name}?`,
      body: n > 0
        ? `This removes the profile and its ${n} linked account${n === 1 ? "" : "s"}, including their saved sessions. This can't be undone.`
        : "This removes the profile. This can't be undone.",
      run: async () => {
        setBusy(p.id)
        await fetch(`/api/profiles/${p.id}`, { method: "DELETE" })
        setBusy(null); load()
      },
    })
  }

  const totalAccounts = profiles.reduce((n, p) => n + (p.accounts?.length || 0), 0)
  const running = profiles.reduce((n, p) => n + (p.accounts?.filter((a) => a.running).length || 0), 0)

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of profiles) for (const a of p.accounts) counts[a.platform] = (counts[a.platform] || 0) + 1
    return counts
  }, [profiles])

  const isFiltering = query.trim().length > 0 || platformTab !== "all"

  const visibleProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = profiles.map((p) => {
      let accounts = platformTab === "all" ? p.accounts : p.accounts.filter((a) => a.platform === platformTab)
      if (q) {
        const profileMatches = p.name.toLowerCase().includes(q) || (p.niche || "").toLowerCase().includes(q)
        if (!profileMatches) accounts = accounts.filter((a) => a.username.toLowerCase().includes(q) || platformLabel(a.platform).toLowerCase().includes(q))
      }
      return { ...p, accounts }
    })
    // Only hide empty-after-filter profiles while actively searching/filtering —
    // otherwise a profile with zero accounts (e.g. right after its last account
    // was deleted) would vanish entirely, with no way to add a new one to it.
    return isFiltering ? filtered.filter((p) => p.accounts.length > 0) : filtered
  }, [profiles, query, platformTab, isFiltering])

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Profiles</h1>
          <div className="subtitle">Identities (proxy + fingerprint) and the accounts that run on them.</div>
        </div>
        <button className="btn primary" onClick={() => setEditingProfile(null)}>
          <Plus size={16} /> New profile
        </button>
      </div>

      <div className="content">
        {connError && <div className="conn-banner">{connError}</div>}

        {loaded && profiles.length > 0 && (
          <>
            <div className="stat-row">
              <div className="stat"><b>{profiles.length}</b> {profiles.length === 1 ? "profile" : "profiles"}</div>
              <div className="stat"><b>{totalAccounts}</b> {totalAccounts === 1 ? "account" : "accounts"}</div>
              <div className="stat"><b>{running}</b> running</div>
              <div className="search-box">
                <Search size={14} className="ic" />
                <input placeholder="Find an account by @handle, platform, or profile…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <X size={14} className="clear" onClick={() => setQuery("")} />}
              </div>
            </div>
            <div className="tab-row">
              <button className={`tab-btn ${platformTab === "all" ? "active" : ""}`} onClick={() => setPlatformTab("all")}>
                All <span className="tab-count">{totalAccounts}</span>
              </button>
              {PLATFORMS.map((pl) => (
                <button key={pl.key} className={`tab-btn ${platformTab === pl.key ? "active" : ""}`} onClick={() => setPlatformTab(pl.key)}>
                  <PlatformIcon platform={pl.key} size={14} /> {pl.label} <span className="tab-count">{platformCounts[pl.key] || 0}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {connError ? null : loaded && profiles.length === 0 ? (
          <div className="empty">
            <Users className="ic" size={34} />
            <h3>No profiles yet</h3>
            <p style={{ maxWidth: 360, margin: "0 auto 18px" }}>
              A profile is one IP identity — a stealth fingerprint pinned to a proxy. Add one or more accounts to it once it exists.
            </p>
            <button className="btn primary" onClick={() => setEditingProfile(null)}><Plus size={16} /> Create your first profile</button>
          </div>
        ) : loaded && visibleProfiles.length === 0 ? (
          <div className="empty">
            <Search className="ic" size={34} />
            <h3>No matches</h3>
            <p>
              {query ? `Nothing matches "${query}"` : `No ${platformLabel(platformTab)} accounts yet`}
              {query && platformTab !== "all" ? ` in ${platformLabel(platformTab)}` : ""}.
            </p>
          </div>
        ) : (
          <div className="cluster-list">
            {visibleProfiles.map((p) => (
              <ProfileCard
                key={p.id} p={p} busy={busy === p.id}
                onLaunchAccount={(accountId) => launchAccount(p.id, accountId)}
                onStopAccount={(accountId) => stopAccount(p.id, accountId)}
                onDeleteAccount={(a) => confirmDeleteAccount(p.id, a)}
                onEditAccount={(a) => setAccountModal({ profile: p, account: a as EditAccount })}
                onAccountCookies={(a) => setCookiesFor(a)}
                onAddAccount={(pr) => setAccountModal({ profile: pr, account: null })}
                onEditProfile={(pr) => setEditingProfile(pr as EditProfile)}
                onDeleteProfile={confirmDeleteProfile}
              />
            ))}
          </div>
        )}
      </div>

      {editingProfile !== undefined && (
        <ProfileModal profile={editingProfile} onClose={() => setEditingProfile(undefined)} onSaved={load} />
      )}
      {accountModal && (
        <AccountModal
          profile={accountModal.profile} account={accountModal.account}
          existingAccounts={profiles.find((p) => p.id === accountModal.profile.id)?.accounts ?? []}
          onClose={() => setAccountModal(null)} onSaved={load}
        />
      )}
      {cookiesFor && (
        <CookiesModal account={cookiesFor} onClose={() => setCookiesFor(null)} onSaved={load} />
      )}
      {confirming && (
        <ConfirmModal
          title={confirming.title} body={confirming.body}
          onCancel={() => setConfirming(null)}
          onConfirm={() => { confirming.run(); setConfirming(null) }}
        />
      )}
      {error && <div className="toast">{error}</div>}
    </>
  )
}
