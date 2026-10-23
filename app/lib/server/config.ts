// Shared settings for the A3 backend. Change a value here, not inside a module.

// ---- Sessions ----
export const SESSION_COOKIE = "sq_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day

// ---- Demo accounts ----
// Seed users with a "fake-hash" password get a real hash of this password when
// the store starts, so you can log in as sam@example.com while building and testing.
export const DEMO_PASSWORD = "password123";

// ---- Queue rules ----
// Positions are 1-based among WAITING entries (1 = next to be served).
// A person is "almost ready" when their position is this number or lower.
export const ALMOST_READY_MAX_POSITION = 2;

// ---- Input limits (used by validation) ----
export const LIMITS = {
  nameMax: 100, // person names, queue names, organization names
  descriptionMax: 500,
  emailMax: 255,
  passwordMin: 8,
  passwordMax: 128,
  durationMinMinutes: 1,
  durationMaxMinutes: 480,
  capacityMin: 1,
  capacityMax: 10000,
  notificationMessageMax: 500,
} as const;
