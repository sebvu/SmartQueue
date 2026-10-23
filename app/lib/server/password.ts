import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Passwords are never stored as plain text. Format: "<salt hex>:<hash hex>".

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}
