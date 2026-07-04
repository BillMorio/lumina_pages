// Cookie-session auth for named operators. No external deps: passwords are
// hashed with scrypt, and session tokens are random bytes whose SHA-256 hash
// is the only thing stored server-side — a DB read alone can't reconstruct a
// usable cookie. Login/logout bracket a login_sessions row, so "how long did
// this person's session last" is answerable straight from the DB.

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto"
import { cookies } from "next/headers"
import {
  getUserByUsername, createUserWithHash, listUsers,
  createLoginSession, findActiveSession, touchSession, endSession, logActivity,
} from "./store"

export const SESSION_COOKIE = "lumina_session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export type SessionUser = { id: number; username: string; role: string }

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const test = scryptSync(password, salt, 64)
  const real = Buffer.from(hash, "hex")
  return test.length === real.length && timingSafeEqual(test, real)
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function setupRequired(): Promise<boolean> {
  return (await listUsers()).length === 0
}

export async function register(username: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const name = username.trim()
  if (!name) return { ok: false, error: "Username is required" }
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" }
  if (await getUserByUsername(name)) return { ok: false, error: "That username is taken" }
  const role = (await setupRequired()) ? "admin" : "operator"
  const user = await createUserWithHash(name, hashPassword(password), role)
  return { ok: true, user: { id: user.id, username: user.username, role: user.role } }
}

export async function login(username: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await getUserByUsername(username.trim())
  if (!user || !verifyPassword(password, user.password_hash)) return { ok: false, error: "Invalid username or password" }
  const token = randomBytes(32).toString("hex")
  await createLoginSession(user.id, hashToken(token))
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE })
  await logActivity(user.id, "login")
  return { ok: true, user: { id: user.id, username: user.username, role: user.role } }
}

export async function logout(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (token) {
    const session = await findActiveSession(hashToken(token))
    await endSession(hashToken(token))
    if (session) await logActivity(session.user_id, "logout")
  }
  cookies().delete(SESSION_COOKIE)
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  const th = hashToken(token)
  const session = await findActiveSession(th)
  if (!session) return null
  await touchSession(th)
  return { id: session.user_id, username: session.username, role: session.role }
}
