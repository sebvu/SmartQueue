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
import type {
  AdminPermission,
  AppNotification,
  CustomRole,
  Organization,
  Queue,
  QueueEntry,
  User,
} from "./types";

// The in-memory "database". Every module reads and writes through getStore().
// Data lives only while the server runs, and A4 will replace this with a real database.

export type Store = {
  users: User[];
  organizations: Organization[];
  queues: Queue[];
  customRoles: CustomRole[];
  queueEntries: QueueEntry[];
  adminPermissions: AdminPermission[];
  notifications: AppNotification[];
  sessions: Map<string, string>; // session token -> userId
};

// Next.js dev mode reloads modules often, which would wipe a normal variable.
// Keeping the store on globalThis makes it survive those reloads.
const globalForStore = globalThis as unknown as { __smartQueueStore?: Store };

let demoPasswordHash: string | null = null;

function seedPasswordHash(user: User): string | null {
  if (user.passwordHash === null || !user.passwordHash.startsWith("fake-hash")) {
    return user.passwordHash;
  }
  // Hash once and reuse, because hashing is deliberately slow.
  demoPasswordHash ??= hashPassword(DEMO_PASSWORD);
  return demoPasswordHash;
}

function createSeededStore(): Store {
  return {
    users: structuredClone(mockUsers).map((u) => ({ ...u, passwordHash: seedPasswordHash(u) })),
    organizations: structuredClone(mockOrganizations),
    queues: structuredClone(mockQueues),
    customRoles: structuredClone(mockCustomRoles),
    queueEntries: structuredClone(mockQueueEntries),
    adminPermissions: structuredClone(mockAdminPermissions),
    notifications: structuredClone(mockNotifications),
    sessions: new Map(),
  };
}

export function getStore(): Store {
  if (!globalForStore.__smartQueueStore) {
    globalForStore.__smartQueueStore = createSeededStore();
  }
  return globalForStore.__smartQueueStore;
}

// Puts the store back to the starting mock data. Call this in tests (beforeEach).
export function resetStore(): Store {
  globalForStore.__smartQueueStore = createSeededStore();
  return globalForStore.__smartQueueStore;
}

// IDs for new rows. The schema uses UUIDs.
export function generateId(): string {
  return crypto.randomUUID();
}
