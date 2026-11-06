import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DEMO_PASSWORD } from "./config";
import {
  mockAdminPermissions,
  mockCustomRoles,
  mockNotifications,
  mockOrganizations,
  mockQueueEntries,
  mockQueues,
  mockUsers,
} from "./mockData";
import { hashPassword } from "./password";
import { SCHEMA_SQL, TABLES_IN_DROP_ORDER } from "./schema";

// The real database (A4). One SQLite file, opened once and shared by every request.
//   - Where it lives: the SMARTQUEUE_DB environment variable, or data/smartqueue.db.
//   - The tests set SMARTQUEUE_DB=":memory:" so they never touch the real file.
//   - The first time the database is created, it is filled with the demo data in mockData.ts.

export type Db = Database.Database;

// Next.js dev mode reloads modules often. Keeping the connection on globalThis
// means we do not open a new one every time.
const globalForDb = globalThis as unknown as { __smartQueueDb?: Db };

function databasePath(): string {
  const configured = process.env.SMARTQUEUE_DB;
  if (configured) return configured;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "smartqueue.db");
}

export function getDb(): Db {
  if (!globalForDb.__smartQueueDb) {
    const db = new Database(databasePath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA_SQL);
    seedIfEmpty(db);
    globalForDb.__smartQueueDb = db;
  }
  return globalForDb.__smartQueueDb;
}

// Wipes every table and loads the demo data again. Tests call this in beforeEach.
export function resetDb(): Db {
  const db = getDb();
  db.pragma("foreign_keys = OFF");
  for (const table of TABLES_IN_DROP_ORDER) db.exec(`DROP TABLE IF EXISTS ${table}`);
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

// ---- Queue order ----
// WAITING entries are ordered by their highest role priority_weight (bigger first),
// then by who joined first. Both the position column and the API use this one rule.
export const WAITING_ORDER_SQL = `
  SELECT e.entry_id AS entry_id,
         ROW_NUMBER() OVER (
           ORDER BY COALESCE(w.weight, 0) DESC, e.joined_at ASC, e.entry_id ASC
         ) AS rank
  FROM queue_entry e
  LEFT JOIN (
    SELECT er.entry_id AS entry_id, MAX(r.priority_weight) AS weight
    FROM queue_entry_role er
    JOIN custom_role r ON r.role_id = er.role_id
    GROUP BY er.entry_id
  ) w ON w.entry_id = e.entry_id
  WHERE e.queue_id = ? AND e.status = 'WAITING'`;

// Rewrites queue_entry.position for one queue: 1, 2, 3... for WAITING entries, NULL for the rest.
export function refreshPositions(db: Db, queueId: string): void {
  db.prepare("UPDATE queue_entry SET position = NULL WHERE queue_id = ?").run(queueId);
  db.prepare(
    `WITH ranked AS (${WAITING_ORDER_SQL})
     UPDATE queue_entry
     SET position = (SELECT rank FROM ranked WHERE ranked.entry_id = queue_entry.entry_id)
     WHERE queue_id = ? AND status = 'WAITING'`
  ).run(queueId, queueId);
}

// ---- Seeding ----

let demoPasswordHash: string | null = null;

// Demo users get a real hash of DEMO_PASSWORD, so you can log in as sam@example.com.
// Hashing is slow on purpose, so it is done once and reused.
function seedPasswordHash(stored: string | null): string | null {
  if (stored === null || !stored.startsWith("fake-hash")) return stored;
  demoPasswordHash ??= hashPassword(DEMO_PASSWORD);
  return demoPasswordHash;
}

function seedIfEmpty(db: Db): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM user_credentials").get() as { n: number };
  if (count.n > 0) return;

  const run = db.transaction(() => {
    const insertCredentials = db.prepare(
      `INSERT INTO user_credentials (user_id, email, password_hash, auth_provider, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertProfile = db.prepare(
      "INSERT INTO user_profile (user_id, full_name, email) VALUES (?, ?, ?)"
    );
    for (const u of mockUsers) {
      insertCredentials.run(u.userId, u.email, seedPasswordHash(u.passwordHash), u.authProvider, u.role, u.createdAt);
      insertProfile.run(u.userId, u.name, u.email);
    }

    const insertOrg = db.prepare(
      "INSERT INTO organization (org_id, owner_id, name, total_capacity_limit, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const o of mockOrganizations) {
      insertOrg.run(o.orgId, o.ownerId, o.name, o.totalCapacityLimit, o.createdAt);
    }

    const insertService = db.prepare(
      `INSERT INTO service (service_id, org_id, name, description, expected_duration_minutes, priority_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertQueue = db.prepare(
      "INSERT INTO queue (queue_id, service_id, status, max_capacity, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const q of mockQueues) {
      insertService.run(q.serviceId, q.orgId, q.name, q.description, q.expectedDurationMinutes, q.priorityLevel, q.createdAt);
      const status = !q.isActive ? "INACTIVE" : q.isOpen ? "OPEN" : "CLOSED";
      insertQueue.run(q.queueId, q.serviceId, status, q.maxCapacity, q.createdAt);
    }

    const insertRole = db.prepare(
      "INSERT INTO custom_role (role_id, queue_id, name, priority_weight) VALUES (?, ?, ?, ?)"
    );
    for (const r of mockCustomRoles) insertRole.run(r.roleId, r.queueId, r.name, r.priorityWeight);

    const insertEntry = db.prepare(
      "INSERT INTO queue_entry (entry_id, queue_id, user_id, joined_at, ended_at, status) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const insertEntryRole = db.prepare("INSERT INTO queue_entry_role (entry_id, role_id) VALUES (?, ?)");
    for (const e of mockQueueEntries) {
      insertEntry.run(e.entryId, e.queueId, e.userId, e.joinedAt, e.endedAt, e.status);
      for (const roleId of e.roleIds) insertEntryRole.run(e.entryId, roleId);
    }

    const insertPermission = db.prepare(
      `INSERT INTO admin_permission (permission_id, user_id, queue_id, can_approve_entries, can_assign_roles,
         can_create_roles, can_create_links, can_override_messages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of mockAdminPermissions) {
      insertPermission.run(
        p.permissionId, p.userId, p.queueId,
        +p.canApproveEntries, +p.canAssignRoles, +p.canCreateRoles, +p.canCreateLinks, +p.canOverrideMessages
      );
    }

    const insertNotification = db.prepare(
      `INSERT INTO notification (notification_id, user_id, entry_id, type, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const n of mockNotifications) {
      insertNotification.run(n.notificationId, n.userId, n.entryId, n.type, n.message, n.isRead ? "VIEWED" : "SENT", n.createdAt);
    }

    for (const q of mockQueues) refreshPositions(db, q.queueId);
  });
  run();
}
