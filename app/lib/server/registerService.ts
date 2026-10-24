import { ApiError } from "./http";
import { createSession, toPublicUser } from "./auth";
import { hashPassword } from "./password";
import { generateId, getStore } from "./store";
import type { PublicUser, User } from "./types";

// Creates a new account with a hashed password and signs the person in.
// Emails are compared in lower case, so Sam@Example.com and sam@example.com are the same account.
export function registerUser(
  username: string,
  email: string,
  password: string
): { token: string; user: PublicUser } {
  const store = getStore();
  const cleanEmail = email.trim().toLowerCase();
  if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.", {
      email: "An account with this email already exists.",
    });
  }
  const user: User = {
    userId: generateId(),
    name: username.trim(),
    email: cleanEmail,
    authProvider: "GENERAL",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  return { token: createSession(user.userId), user: toPublicUser(user) };
}
