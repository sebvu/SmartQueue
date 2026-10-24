import { ApiError } from "./http";
import { verifyPassword } from "./password";
import { createSession, toPublicUser } from "./auth";
import { getStore } from "./store";
import type { PublicUser } from "./types";

// TEMPORARY login so the /api/me endpoints can be tried in the browser.
// Jester's real auth can replace this file and the three routes in app/api/auth.

export function loginWithPassword(email: string, password: string): { token: string; user: PublicUser } {
  const user = getStore().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  // Same message for a wrong email and a wrong password, so nobody can probe which emails exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, "UNAUTHENTICATED", "Incorrect email or password.");
  }
  return { token: createSession(user.userId), user: toPublicUser(user) };
}
