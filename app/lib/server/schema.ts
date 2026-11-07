// The database schema (SQLite). docs/schema.sql is a copy of this text for the A4 write-up,
// and a test fails if the two ever differ, so edit this file and then copy it over.
//
// A4 table name         -> table here
//   UserCredentials     -> user_credentials
//   UserProfile         -> user_profile
//   Service             -> service
//   Queue               -> queue
//   QueueEntry          -> queue_entry
//   Notification/History-> notification (history = queue_entry rows that have ended)
// Extra tables from A1: organization, custom_role, queue_entry_role, admin_permission, session.

export const SCHEMA_SQL = `-- QueueSmart database schema (SQLite)
PRAGMA foreign_keys = ON;

-- 1. UserCredentials: who can log in. Passwords are stored only as scrypt hashes.
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id        TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE
                   CHECK (length(email) BETWEEN 3 AND 255),
  password_hash  TEXT,  -- NULL for Google and Apple accounts
  auth_provider  TEXT NOT NULL DEFAULT 'GENERAL'
                   CHECK (auth_provider IN ('GOOGLE', 'APPLE', 'GENERAL')),
  role           TEXT NOT NULL DEFAULT 'USER'
                   CHECK (role IN ('USER', 'ADMIN')),
  created_at     TEXT NOT NULL,
  CHECK (auth_provider <> 'GENERAL' OR password_hash IS NOT NULL)
);

-- 2. UserProfile: details about the person. One row per user.
CREATE TABLE IF NOT EXISTS user_profile (
  user_id      TEXT PRIMARY KEY REFERENCES user_credentials(user_id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 100),
  email        TEXT NOT NULL UNIQUE COLLATE NOCASE
                 REFERENCES user_credentials(email) ON UPDATE CASCADE,
  phone        TEXT CHECK (phone IS NULL OR length(phone) <= 30),
  preferences  TEXT CHECK (preferences IS NULL OR length(preferences) <= 1000) -- JSON text
);

CREATE TABLE IF NOT EXISTS organization (
  org_id               TEXT PRIMARY KEY,
  owner_id             TEXT NOT NULL REFERENCES user_credentials(user_id),
  name                 TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  total_capacity_limit INTEGER NOT NULL CHECK (total_capacity_limit >= 1),
  created_at           TEXT NOT NULL
);

-- 3. Service: what an organization offers.
CREATE TABLE IF NOT EXISTS service (
  service_id                TEXT PRIMARY KEY,
  org_id                    TEXT NOT NULL REFERENCES organization(org_id),
  name                      TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description               TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  expected_duration_minutes INTEGER NOT NULL CHECK (expected_duration_minutes BETWEEN 1 AND 480),
  priority_level            TEXT NOT NULL DEFAULT 'MEDIUM'
                              CHECK (priority_level IN ('LOW', 'MEDIUM', 'HIGH')),
  created_at                TEXT NOT NULL
);

-- 4. Queue: the live line for one service.
--    OPEN = taking joins, CLOSED = visible but no new joins, INACTIVE = hidden (history kept).
CREATE TABLE IF NOT EXISTS queue (
  queue_id      TEXT PRIMARY KEY,
  service_id    TEXT NOT NULL UNIQUE REFERENCES service(service_id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'INACTIVE')),
  max_capacity  INTEGER NOT NULL CHECK (max_capacity BETWEEN 1 AND 10000),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_role (
  role_id         TEXT PRIMARY KEY,
  queue_id        TEXT NOT NULL REFERENCES queue(queue_id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  priority_weight INTEGER NOT NULL CHECK (priority_weight >= 0)
);

-- 5. QueueEntry: one person's place in one queue. position is kept up to date by the
--    backend (1 = next to be served) and is NULL unless the status is WAITING.
CREATE TABLE IF NOT EXISTS queue_entry (
  entry_id   TEXT PRIMARY KEY,
  queue_id   TEXT NOT NULL REFERENCES queue(queue_id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES user_credentials(user_id) ON DELETE CASCADE,
  position   INTEGER CHECK (position IS NULL OR position >= 1),
  joined_at  TEXT NOT NULL,
  ended_at   TEXT,
  status     TEXT NOT NULL DEFAULT 'WAITING'
               CHECK (status IN ('PENDING_APPROVAL', 'WAITLISTED', 'WAITING', 'FIRST_IN_LINE',
                                 'SERVING', 'VERIFIED', 'COMPLETED', 'CANCELLED', 'REMOVED')),
  CHECK ((status IN ('COMPLETED', 'CANCELLED', 'REMOVED')) = (ended_at IS NOT NULL))
);

-- A person can be in a queue only once at a time, and only one person is served at a time.
CREATE UNIQUE INDEX IF NOT EXISTS ux_entry_one_active_per_user
  ON queue_entry(user_id, queue_id)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'REMOVED');
CREATE UNIQUE INDEX IF NOT EXISTS ux_entry_one_serving_per_queue
  ON queue_entry(queue_id) WHERE status = 'SERVING';
CREATE INDEX IF NOT EXISTS ix_entry_user ON queue_entry(user_id);

CREATE TABLE IF NOT EXISTS queue_entry_role (
  entry_id TEXT NOT NULL REFERENCES queue_entry(entry_id) ON DELETE CASCADE,
  role_id  TEXT NOT NULL REFERENCES custom_role(role_id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_permission (
  permission_id         TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES user_credentials(user_id) ON DELETE CASCADE,
  queue_id              TEXT NOT NULL REFERENCES queue(queue_id) ON DELETE CASCADE,
  can_approve_entries   INTEGER NOT NULL DEFAULT 0 CHECK (can_approve_entries IN (0, 1)),
  can_assign_roles      INTEGER NOT NULL DEFAULT 0 CHECK (can_assign_roles IN (0, 1)),
  can_create_roles      INTEGER NOT NULL DEFAULT 0 CHECK (can_create_roles IN (0, 1)),
  can_create_links      INTEGER NOT NULL DEFAULT 0 CHECK (can_create_links IN (0, 1)),
  can_override_messages INTEGER NOT NULL DEFAULT 0 CHECK (can_override_messages IN (0, 1)),
  UNIQUE (user_id, queue_id),
  CHECK (can_create_roles = 0 OR can_assign_roles = 1),
  CHECK (can_override_messages = 0 OR can_create_links = 1)
);

-- 6. Notification / History: what the system told each user.
CREATE TABLE IF NOT EXISTS notification (
  notification_id TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user_credentials(user_id) ON DELETE CASCADE,
  entry_id        TEXT REFERENCES queue_entry(entry_id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('QUEUE_UPDATE', 'STATUS_CHANGE')),
  message         TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 500),
  status          TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'VIEWED')),
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_notification_user ON notification(user_id);

-- Login sessions (the token is the value of the sq_session cookie).
CREATE TABLE IF NOT EXISTS session (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES user_credentials(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
`;

// Dropping order matters because of the foreign keys. Used by resetDb() in tests.
export const TABLES_IN_DROP_ORDER = [
  "session",
  "notification",
  "queue_entry_role",
  "admin_permission",
  "queue_entry",
  "custom_role",
  "queue",
  "service",
  "organization",
  "user_profile",
  "user_credentials",
];
