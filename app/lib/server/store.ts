import { resetDb } from "./db";

// A3 kept all data in memory here. A4 moved it into SQLite (see db.ts, schema.ts and repo.ts),
// so this file now only holds two small helpers that the rest of the backend already imports.

// IDs for new rows. The schema uses UUIDs.
export function generateId(): string {
  return crypto.randomUUID();
}

// Puts the database back to the demo data. Call this in tests (beforeEach).
export function resetStore(): void {
  resetDb();
}
