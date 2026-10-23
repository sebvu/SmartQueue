import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./config";
import { ApiError } from "./http";
import { generateId, getStore } from "./store";
import type { PublicUser, User } from "./types";

// "Logged in" means the request carries a valid session token, either in the
// sq_session cookie (what the browser sends) or an "Authorization: Bearer <token>" header
// (handy for tests and tools). Tokens live in the in-memory store.

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key) cookies[key] = part.slice(index + 1).trim();
  }
  return cookies;
}

export function getSessionToken(request: Request): string | null {
  const fromCookie = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (fromCookie) return fromCookie;
  const authorization = request.headers.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }
  return null;
}

export function createSession(userId: string): string {
  const token = generateId();
  getStore().sessions.set(token, userId);
  return token;
}

export function destroySession(token: string): void {
  getStore().sessions.delete(token);
}

export function getCurrentUser(request: Request): User | null {
  const token = getSessionToken(request);
  if (!token) return null;
  const store = getStore();
  const userId = store.sessions.get(token);
  if (!userId) return null;
  return store.users.find((u) => u.userId === userId) ?? null;
}

export function requireUser(request: Request): User {
  const user = getCurrentUser(request);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please log in to continue.");
  return user;
}

// Never send a User straight to the front end, because it includes passwordHash.
export function toPublicUser(user: User): PublicUser {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    authProvider: user.authProvider,
    createdAt: user.createdAt,
  };
}

// Values for the Set-Cookie header on login, register, and logout.
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
