import { ApiError } from "./http";
import { verifyPassword } from "./password";
import { createSession, toPublicUser } from "./auth";
import * as repo from "./repo";
import type { PublicUser } from "./types";

// Login for /api/auth/login: checks the password against the stored hash and starts a session.

export function loginWithPassword(email: string, password: string): { token: string; user: PublicUser } {
  const user = repo.findUserByEmail(email);
  // Same message for a wrong email and a wrong password, so nobody can probe which emails exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, "UNAUTHENTICATED", "Incorrect email or password.");
  }
  return { token: createSession(user.userId), user: toPublicUser(user) };
}
