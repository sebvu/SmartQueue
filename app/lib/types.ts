// Types that mirror smartqueue_schema_revised.sql, in camelCase.
// A3 keeps everything in memory, so these are plain objects, not database rows.
//
// Not modeled yet (they exist in the schema, but A3 does not need them):
// queue_links, queue_link_roles, geofencing, questionnaires, approval flow,
// verification tokens. queue_entry_roles is a roleIds array on QueueEntry.

// ---- Enums (same values as the schema) ----

export type AuthProvider = "GOOGLE" | "APPLE" | "GENERAL";

export type EntryStatus =
  | "PENDING_APPROVAL"
  | "WAITLISTED"
  | "WAITING"
  | "FIRST_IN_LINE"
  | "SERVING" // the one person at the counter ("Current User")
  | "VERIFIED"
  | "COMPLETED"
  | "CANCELLED"
  | "REMOVED";

export type NotificationType = "QUEUE_UPDATE" | "STATUS_CHANGE";

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH";

// ---- Tables ----

export type User = {
  userId: string;
  name: string;
  email: string;
  authProvider: AuthProvider;
  passwordHash: string | null; // null for Google and Apple accounts
  createdAt: string; // ISO timestamp
};

// What the API may send to the front end. Never include passwordHash.
export type PublicUser = Omit<User, "passwordHash">;

export type Organization = {
  orgId: string;
  ownerId: string; // a userId
  name: string;
  totalCapacityLimit: number;
  createdAt: string;
};

// The A2 "service".
export type Queue = {
  queueId: string;
  orgId: string;
  name: string; // max 100 characters
  description: string;
  expectedDurationMinutes: number;
  priorityLevel: PriorityLevel;
  isActive: boolean; // false means deactivated: hidden, no joins, history kept
  isOpen: boolean; // false means closed: still visible, no new joins, can be reopened
  maxCapacity: number;
  createdAt: string;
};

export type CustomRole = {
  roleId: string;
  queueId: string;
  name: string;
  priorityWeight: number; // higher is served sooner
};

export type QueueEntry = {
  entryId: string;
  userId: string;
  queueId: string;
  joinedAt: string;
  endedAt: string | null; // set for COMPLETED, CANCELLED, REMOVED; null while active
  status: EntryStatus;
  roleIds: string[]; // replaces the queue_entry_roles junction table
};

export type AdminPermission = {
  permissionId: string;
  userId: string;
  queueId: string;
  canApproveEntries: boolean;
  canAssignRoles: boolean;
  canCreateRoles: boolean; // requires canAssignRoles
  canCreateLinks: boolean;
  canOverrideMessages: boolean; // requires canCreateLinks
};

// Named AppNotification because browsers already have a built-in Notification type.
export type AppNotification = {
  notificationId: string;
  userId: string;
  entryId: string | null;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
};