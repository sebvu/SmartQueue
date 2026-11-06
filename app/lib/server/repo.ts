import { getDb, refreshPositions, WAITING_ORDER_SQL } from "./db";
import type {
  AppNotification,
  EntryStatus,
  Organization,
  Queue,
  QueueEntry,
  User,
} from "./types";

// Every database read and write goes through this file. Routes and services never write SQL.
// Each function turns database rows (snake_case) into the objects in types.ts (camelCase).
// Changes that touch more than one table run inside a transaction, so they happen all together or not at all.

// ---------------------------------------------------------------- users

type UserRow = {
  user_id: string;
  full_name: string;
  email: string;
  auth_provider: User["authProvider"];
  role: User["role"];
  password_hash: string | null;
  created_at: string;
};

const USER_SELECT = `
  SELECT c.user_id, p.full_name, c.email, c.auth_provider, c.role, c.password_hash, c.created_at
  FROM user_credentials c JOIN user_profile p ON p.user_id = c.user_id`;

function toUser(r: UserRow): User {
  return {
    userId: r.user_id,
    name: r.full_name,
    email: r.email,
    authProvider: r.auth_provider,
    role: r.role,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
  };
}

export function findUserById(userId: string): User | null {
  const row = getDb().prepare(`${USER_SELECT} WHERE c.user_id = ?`).get(userId) as UserRow | undefined;
  return row ? toUser(row) : null;
}

// Email matching ignores upper and lower case (the column is COLLATE NOCASE).
export function findUserByEmail(email: string): User | null {
  const row = getDb().prepare(`${USER_SELECT} WHERE c.email = ?`).get(email.trim()) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function listUsers(): User[] {
  return (getDb().prepare(`${USER_SELECT} ORDER BY c.created_at, c.user_id`).all() as UserRow[]).map(toUser);
}

// Creates the login row and the profile row together. Throws if the email is already used.
export function insertUser(user: User): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO user_credentials (user_id, email, password_hash, auth_provider, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(user.userId, user.email, user.passwordHash, user.authProvider, user.role, user.createdAt);
    db.prepare("INSERT INTO user_profile (user_id, full_name, email) VALUES (?, ?, ?)").run(
      user.userId, user.name, user.email
    );
  })();
}

export type UserProfile = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  preferences: Record<string, unknown> | null;
};

type ProfileRow = { user_id: string; full_name: string; email: string; phone: string | null; preferences: string | null };

function toProfile(r: ProfileRow): UserProfile {
  let preferences: Record<string, unknown> | null = null;
  if (r.preferences) {
    try {
      preferences = JSON.parse(r.preferences) as Record<string, unknown>;
    } catch {
      preferences = null;
    }
  }
  return { userId: r.user_id, fullName: r.full_name, email: r.email, phone: r.phone, preferences };
}

export function getProfile(userId: string): UserProfile | null {
  const row = getDb()
    .prepare("SELECT user_id, full_name, email, phone, preferences FROM user_profile WHERE user_id = ?")
    .get(userId) as ProfileRow | undefined;
  return row ? toProfile(row) : null;
}

export function updateProfile(
  userId: string,
  changes: { fullName?: string; phone?: string | null; preferences?: Record<string, unknown> | null }
): UserProfile | null {
  const current = getProfile(userId);
  if (!current) return null;
  const fullName = changes.fullName ?? current.fullName;
  const phone = changes.phone === undefined ? current.phone : changes.phone;
  const preferences = changes.preferences === undefined ? current.preferences : changes.preferences;
  getDb()
    .prepare("UPDATE user_profile SET full_name = ?, phone = ?, preferences = ? WHERE user_id = ?")
    .run(fullName, phone, preferences === null ? null : JSON.stringify(preferences), userId);
  return getProfile(userId);
}

// ---------------------------------------------------------------- sessions

export function insertSession(token: string, userId: string): void {
  getDb()
    .prepare("INSERT INTO session (token, user_id, created_at) VALUES (?, ?, ?)")
    .run(token, userId, new Date().toISOString());
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM session WHERE token = ?").run(token);
}

export function findUserBySession(token: string): User | null {
  const row = getDb()
    .prepare(`${USER_SELECT} JOIN session s ON s.user_id = c.user_id WHERE s.token = ?`)
    .get(token) as UserRow | undefined;
  return row ? toUser(row) : null;
}

// ---------------------------------------------------------------- organizations and admins

type OrgRow = { org_id: string; owner_id: string; name: string; total_capacity_limit: number; created_at: string };

export function findOrganization(orgId: string): Organization | null {
  const r = getDb().prepare("SELECT * FROM organization WHERE org_id = ?").get(orgId) as OrgRow | undefined;
  return r
    ? { orgId: r.org_id, ownerId: r.owner_id, name: r.name, totalCapacityLimit: r.total_capacity_limit, createdAt: r.created_at }
    : null;
}

export function listOwnedOrgIds(userId: string): string[] {
  const rows = getDb().prepare("SELECT org_id FROM organization WHERE owner_id = ?").all(userId) as { org_id: string }[];
  return rows.map((r) => r.org_id);
}

export function hasAdminPermission(userId: string, queueId: string): boolean {
  return !!getDb()
    .prepare("SELECT 1 FROM admin_permission WHERE user_id = ? AND queue_id = ?")
    .get(userId, queueId);
}

export function listAdminQueueIds(userId: string): string[] {
  const rows = getDb().prepare("SELECT queue_id FROM admin_permission WHERE user_id = ?").all(userId) as { queue_id: string }[];
  return rows.map((r) => r.queue_id);
}

// ---------------------------------------------------------------- services and queues
// The API shows a service and its queue as one object (Queue in types.ts).

type QueueRow = {
  queue_id: string;
  service_id: string;
  org_id: string;
  name: string;
  description: string;
  expected_duration_minutes: number;
  priority_level: Queue["priorityLevel"];
  status: "OPEN" | "CLOSED" | "INACTIVE";
  max_capacity: number;
  created_at: string;
};

const QUEUE_SELECT = `
  SELECT q.queue_id, q.service_id, s.org_id, s.name, s.description, s.expected_duration_minutes,
         s.priority_level, q.status, q.max_capacity, q.created_at
  FROM queue q JOIN service s ON s.service_id = q.service_id`;

function toQueue(r: QueueRow): Queue {
  return {
    queueId: r.queue_id,
    serviceId: r.service_id,
    orgId: r.org_id,
    name: r.name,
    description: r.description,
    expectedDurationMinutes: r.expected_duration_minutes,
    priorityLevel: r.priority_level,
    isActive: r.status !== "INACTIVE",
    isOpen: r.status === "OPEN",
    maxCapacity: r.max_capacity,
    createdAt: r.created_at,
  };
}

function statusOf(q: Pick<Queue, "isActive" | "isOpen">): QueueRow["status"] {
  return !q.isActive ? "INACTIVE" : q.isOpen ? "OPEN" : "CLOSED";
}

export function findQueue(queueId: string): Queue | null {
  const r = getDb().prepare(`${QUEUE_SELECT} WHERE q.queue_id = ?`).get(queueId) as QueueRow | undefined;
  return r ? toQueue(r) : null;
}

export function listQueues(options: { activeOnly?: boolean } = {}): Queue[] {
  const where = options.activeOnly ? "WHERE q.status <> 'INACTIVE'" : "";
  const rows = getDb().prepare(`${QUEUE_SELECT} ${where} ORDER BY q.created_at, q.queue_id`).all() as QueueRow[];
  return rows.map(toQueue);
}

// Creates the service row and its queue row together.
export function insertQueue(queue: Queue): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO service (service_id, org_id, name, description, expected_duration_minutes, priority_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(queue.serviceId, queue.orgId, queue.name, queue.description, queue.expectedDurationMinutes, queue.priorityLevel, queue.createdAt);
    db.prepare("INSERT INTO queue (queue_id, service_id, status, max_capacity, created_at) VALUES (?, ?, ?, ?, ?)").run(
      queue.queueId, queue.serviceId, statusOf(queue), queue.maxCapacity, queue.createdAt
    );
  })();
}

export type QueueChanges = Partial<
  Pick<Queue, "name" | "description" | "expectedDurationMinutes" | "priorityLevel" | "isOpen" | "isActive" | "maxCapacity">
>;

// Changes only the fields that are given. Returns the updated queue, or null if there is no such queue.
export function updateQueue(queueId: string, changes: QueueChanges): Queue | null {
  const current = findQueue(queueId);
  if (!current) return null;
  const next = { ...current, ...changes };
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "UPDATE service SET name = ?, description = ?, expected_duration_minutes = ?, priority_level = ? WHERE service_id = ?"
    ).run(next.name, next.description, next.expectedDurationMinutes, next.priorityLevel, current.serviceId);
    db.prepare("UPDATE queue SET status = ?, max_capacity = ? WHERE queue_id = ?").run(
      statusOf(next), next.maxCapacity, queueId
    );
  })();
  return findQueue(queueId);
}

export function getRoleWeights(queueId: string): Map<string, number> {
  const rows = getDb().prepare("SELECT role_id, priority_weight FROM custom_role WHERE queue_id = ?").all(queueId) as {
    role_id: string;
    priority_weight: number;
  }[];
  return new Map(rows.map((r) => [r.role_id, r.priority_weight]));
}

// ---------------------------------------------------------------- queue entries

type EntryRow = {
  entry_id: string;
  user_id: string;
  queue_id: string;
  joined_at: string;
  ended_at: string | null;
  status: EntryStatus;
};

const ENTRY_SELECT = "SELECT entry_id, user_id, queue_id, joined_at, ended_at, status FROM queue_entry";

function roleIdsFor(entryId: string): string[] {
  const rows = getDb().prepare("SELECT role_id FROM queue_entry_role WHERE entry_id = ? ORDER BY role_id").all(entryId) as {
    role_id: string;
  }[];
  return rows.map((r) => r.role_id);
}

function toEntry(r: EntryRow): QueueEntry {
  return {
    entryId: r.entry_id,
    userId: r.user_id,
    queueId: r.queue_id,
    joinedAt: r.joined_at,
    endedAt: r.ended_at,
    status: r.status,
    roleIds: roleIdsFor(r.entry_id),
  };
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

export function findEntry(entryId: string): QueueEntry | null {
  const r = getDb().prepare(`${ENTRY_SELECT} WHERE entry_id = ?`).get(entryId) as EntryRow | undefined;
  return r ? toEntry(r) : null;
}

export function listEntriesByUser(userId: string, statuses: readonly EntryStatus[]): QueueEntry[] {
  const rows = getDb()
    .prepare(`${ENTRY_SELECT} WHERE user_id = ? AND status IN (${placeholders(statuses)}) ORDER BY joined_at, entry_id`)
    .all(userId, ...statuses) as EntryRow[];
  return rows.map(toEntry);
}

export function listEntriesByQueue(queueId: string, statuses?: readonly EntryStatus[]): QueueEntry[] {
  const filter = statuses ? ` AND status IN (${placeholders(statuses)})` : "";
  const rows = getDb()
    .prepare(`${ENTRY_SELECT} WHERE queue_id = ?${filter} ORDER BY joined_at, entry_id`)
    .all(queueId, ...(statuses ?? [])) as EntryRow[];
  return rows.map(toEntry);
}

export function findActiveEntry(userId: string, queueId: string, statuses: readonly EntryStatus[]): QueueEntry | null {
  const r = getDb()
    .prepare(`${ENTRY_SELECT} WHERE user_id = ? AND queue_id = ? AND status IN (${placeholders(statuses)}) LIMIT 1`)
    .get(userId, queueId, ...statuses) as EntryRow | undefined;
  return r ? toEntry(r) : null;
}

export function countEntries(queueId: string, statuses: readonly EntryStatus[]): number {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM queue_entry WHERE queue_id = ? AND status IN (${placeholders(statuses)})`)
    .get(queueId, ...statuses) as { n: number };
  return r.n;
}

// WAITING entries in the order they will be served.
export function listWaitingOrdered(queueId: string): QueueEntry[] {
  const rows = getDb().prepare(`SELECT entry_id FROM (${WAITING_ORDER_SQL}) ORDER BY rank`).all(queueId) as {
    entry_id: string;
  }[];
  return rows.map((r) => findEntry(r.entry_id)!);
}

export function insertEntry(entry: QueueEntry): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "INSERT INTO queue_entry (entry_id, queue_id, user_id, joined_at, ended_at, status) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(entry.entryId, entry.queueId, entry.userId, entry.joinedAt, entry.endedAt, entry.status);
    const addRole = db.prepare("INSERT INTO queue_entry_role (entry_id, role_id) VALUES (?, ?)");
    for (const roleId of entry.roleIds) addRole.run(entry.entryId, roleId);
    refreshPositions(db, entry.queueId);
  })();
}

// Sets the status (and the end time, for statuses that end the visit) and re-numbers the line.
export function setEntryStatus(entryId: string, status: EntryStatus, endedAt: string | null = null): QueueEntry | null {
  const db = getDb();
  const current = findEntry(entryId);
  if (!current) return null;
  db.transaction(() => {
    db.prepare("UPDATE queue_entry SET status = ?, ended_at = ? WHERE entry_id = ?").run(status, endedAt, entryId);
    refreshPositions(db, current.queueId);
  })();
  return findEntry(entryId);
}

export function getEntryPosition(entryId: string): number | null {
  const r = getDb().prepare("SELECT position FROM queue_entry WHERE entry_id = ?").get(entryId) as
    | { position: number | null }
    | undefined;
  return r?.position ?? null;
}

// Finishes whoever is being served and starts the first person in line. Both changes happen together.
// Returns what happened so the caller can answer the request.
export function advanceQueue(queueId: string): { completed: QueueEntry | null; serving: QueueEntry | null } {
  const db = getDb();
  return db.transaction(() => {
    const now = new Date().toISOString();
    const current = listEntriesByQueue(queueId, ["SERVING"])[0] ?? null;
    if (current) {
      db.prepare("UPDATE queue_entry SET status = 'COMPLETED', ended_at = ? WHERE entry_id = ?").run(now, current.entryId);
    }
    const next = listWaitingOrdered(queueId)[0] ?? null;
    if (next) db.prepare("UPDATE queue_entry SET status = 'SERVING' WHERE entry_id = ?").run(next.entryId);
    refreshPositions(db, queueId);
    return {
      completed: current ? findEntry(current.entryId) : null,
      serving: next ? findEntry(next.entryId) : null,
    };
  })();
}

// ---------------------------------------------------------------- notifications

type NotificationRow = {
  notification_id: string;
  user_id: string;
  entry_id: string | null;
  type: AppNotification["type"];
  message: string;
  status: "SENT" | "VIEWED";
  created_at: string;
};

function toNotification(r: NotificationRow): AppNotification {
  return {
    notificationId: r.notification_id,
    userId: r.user_id,
    entryId: r.entry_id,
    type: r.type,
    message: r.message,
    isRead: r.status === "VIEWED",
    createdAt: r.created_at,
  };
}

export function listNotificationsForUser(userId: string): AppNotification[] {
  const rows = getDb()
    .prepare("SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC, notification_id DESC")
    .all(userId) as NotificationRow[];
  return rows.map(toNotification);
}

export function findNotification(userId: string, notificationId: string): AppNotification | null {
  const r = getDb()
    .prepare("SELECT * FROM notification WHERE notification_id = ? AND user_id = ?")
    .get(notificationId, userId) as NotificationRow | undefined;
  return r ? toNotification(r) : null;
}

export function insertNotification(n: AppNotification): void {
  getDb()
    .prepare(
      `INSERT INTO notification (notification_id, user_id, entry_id, type, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(n.notificationId, n.userId, n.entryId, n.type, n.message, n.isRead ? "VIEWED" : "SENT", n.createdAt);
}

export function setNotificationStatus(userId: string, notificationId: string, isRead: boolean): boolean {
  const result = getDb()
    .prepare("UPDATE notification SET status = ? WHERE notification_id = ? AND user_id = ?")
    .run(isRead ? "VIEWED" : "SENT", notificationId, userId);
  return result.changes > 0;
}

export function markAllNotificationsViewed(userId: string): number {
  return getDb().prepare("UPDATE notification SET status = 'VIEWED' WHERE user_id = ? AND status = 'SENT'").run(userId).changes;
}
