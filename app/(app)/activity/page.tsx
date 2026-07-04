import { listActivity, listAccountSessions } from "@/lib/engine/store"
import { platformLabel } from "@/lib/platforms"
import PlatformIcon from "@/components/PlatformIcon"

function timeAgo(iso: string | null) {
  if (!iso) return "—"
  const norm = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z"
  const t = new Date(norm).getTime()
  if (Number.isNaN(t)) return "—"
  const d = (Date.now() - t) / 1000
  if (d < 45) return "just now"
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function formatSeconds(s: number) {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function liveDuration(startIso: string) {
  const start = new Date(startIso.includes("T") ? startIso : startIso.replace(" ", "T") + "Z").getTime()
  return formatSeconds(Math.max(0, Math.round((Date.now() - start) / 1000)))
}

const ACTION_LABEL: Record<string, string> = {
  login: "logged in",
  logout: "logged out",
  "profile.create": "created profile",
  "profile.update": "edited profile",
  "profile.delete": "deleted profile",
  "account.create": "added account",
  "account.update": "edited account",
  "account.delete": "deleted account",
  "account.launch": "launched account",
  "account.stop": "stopped account",
  "account.cookies_import": "imported session for",
  "account.cookies_clear": "cleared session for",
}

function describe(action: string, meta: Record<string, unknown> | null): string {
  const label = ACTION_LABEL[action] || action
  if (!meta) return label
  const bits: string[] = []
  if (meta.name) bits.push(String(meta.name))
  if (meta.username) bits.push(`@${meta.username}`)
  if (meta.platform) bits.push(`(${meta.platform})`)
  if (typeof meta.count === "number" && action.startsWith("account.cookies")) bits.push(`· ${meta.count} cookies`)
  return bits.length ? `${label} ${bits.join(" ")}` : label
}

export default async function ActivityPage() {
  const [sessions, activity] = await Promise.all([listAccountSessions(200), listActivity(200)])

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Activity</h1>
          <div className="subtitle">Browser sessions per account — who launched what, on which IP, and for how long.</div>
        </div>
      </div>

      <div className="content">
        <div className="activity-cols">
          <div className="activity-panel">
            <div className="panel-head">Browser sessions</div>
            {sessions.length === 0 ? (
              <div className="acct-empty">No accounts have been launched yet.</div>
            ) : (
              <div className="activity-list">
                {sessions.map((s, i) => (
                  <div key={i} className="session-row">
                    {s.platform ? <PlatformIcon platform={s.platform} size={16} /> : <span className="session-noplatform" />}
                    <div className="session-id">
                      <div className="session-user">
                        @{s.username || "unknown"}
                        {s.platform && <span className="session-platform"> · {platformLabel(s.platform)}</span>}
                      </div>
                      <div className="session-meta">
                        {s.profileName ? `on ${s.profileName}` : "profile unknown"} · launched by {s.launchedByUsername || "unknown"}
                      </div>
                    </div>
                    <span className={`status-pill xs ${s.endedAt ? "idle" : "running"}`}>
                      <span className={`dot ${s.endedAt ? "" : "live"}`} />
                    </span>
                    <span className="session-duration">
                      {s.endedAt ? (s.durationSeconds != null ? formatSeconds(s.durationSeconds) : "—") : `${liveDuration(s.startedAt)} (running)`}
                    </span>
                    <span className="activity-time">{timeAgo(s.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="activity-panel subtle">
            <div className="panel-head">Action log</div>
            {activity.length === 0 ? (
              <div className="acct-empty">Nothing logged yet.</div>
            ) : (
              <div className="activity-list">
                {activity.map((e) => {
                  const meta = e.meta ? JSON.parse(e.meta) : null
                  return (
                    <div key={e.id} className="activity-row">
                      <span className="activity-user">{e.username || "system"}</span>
                      <span className="activity-desc">{describe(e.action, meta)}</span>
                      <span className="activity-time">{timeAgo(e.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
