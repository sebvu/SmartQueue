// Starting data for the A3 in-memory backend. Matches types.ts and the schema rules:
// - finished entries (COMPLETED, CANCELLED, REMOVED) have endedAt, active ones have null
// - a user has at most one active entry per queue, and at most one SERVING entry per queue
// - createRoles needs assignRoles, overrideMessages needs createLinks
//
// Queues: q3 is deactivated (isActive false), q7 is closed (isOpen false but still active).
//
// Queue order = highest role priorityWeight first, then earliest joinedAt.
// Expected order of active entries (userIds), useful for tests:
//   q1 General Advising:  u4 > u3 > u5 > u8 > u9
//   q2 Financial Aid:     u5 > u10
//   q4 Registrar:         u4 > u10   (u9 is SERVING, so not in the waiting list)
//   q5 Career Services:   u8 > u9
//   q6 Equipment Checkout: u10 > u3

import type {
  User,
  Organization,
  Queue,
  CustomRole,
  QueueEntry,
  AdminPermission,
  AppNotification,
} from "./types";

export const mockUsers: User[] = [
  { userId: "u1", name: "Olivia Owner", email: "owner@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-1", createdAt: "2026-09-01T09:00:00" },
  { userId: "u2", name: "Adam Admin", email: "admin@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-2", createdAt: "2026-09-02T09:00:00" },
  { userId: "u3", name: "Sam Student", email: "sam@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-3", createdAt: "2026-09-03T09:00:00" },
  { userId: "u4", name: "Jordan Student", email: "jordan@example.com", authProvider: "GOOGLE", passwordHash: null, createdAt: "2026-09-04T09:00:00" },
  { userId: "u5", name: "Casey Student", email: "casey@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-5", createdAt: "2026-09-05T09:00:00" },
  { userId: "u6", name: "Priya Patel", email: "priya@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-6", createdAt: "2026-09-06T09:00:00" },
  { userId: "u7", name: "Marcus Admin", email: "marcus@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-7", createdAt: "2026-09-07T09:00:00" },
  { userId: "u8", name: "Elena Student", email: "elena@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-8", createdAt: "2026-09-08T09:00:00" },
  { userId: "u9", name: "Devon Student", email: "devon@example.com", authProvider: "GENERAL", passwordHash: "fake-hash-9", createdAt: "2026-09-09T09:00:00" },
  { userId: "u10", name: "Riley Student", email: "riley@example.com", authProvider: "APPLE", passwordHash: null, createdAt: "2026-09-10T09:00:00" },
];

export const mockOrganizations: Organization[] = [
  { orgId: "o1", ownerId: "u1", name: "University Student Services", totalCapacityLimit: 1000, createdAt: "2026-09-01T09:30:00" },
  { orgId: "o2", ownerId: "u6", name: "Campus Recreation", totalCapacityLimit: 300, createdAt: "2026-09-06T09:30:00" },
];

export const mockQueues: Queue[] = [
  { queueId: "q1", orgId: "o1", name: "General Advising", description: "Walk-in academic advising", expectedDurationMinutes: 15, priorityLevel: "MEDIUM", isActive: true, isOpen: true, maxCapacity: 50, createdAt: "2026-09-01T10:00:00" },
  { queueId: "q2", orgId: "o1", name: "Financial Aid", description: "Questions about aid and billing", expectedDurationMinutes: 20, priorityLevel: "HIGH", isActive: true, isOpen: true, maxCapacity: 50, createdAt: "2026-09-01T10:05:00" },
  { queueId: "q3", orgId: "o1", name: "IT Help Desk", description: "Account and device support", expectedDurationMinutes: 10, priorityLevel: "LOW", isActive: false, isOpen: false, maxCapacity: 30, createdAt: "2026-09-01T10:10:00" },
  { queueId: "q4", orgId: "o1", name: "Registrar", description: "Transcripts, enrollment verification, and records", expectedDurationMinutes: 12, priorityLevel: "MEDIUM", isActive: true, isOpen: true, maxCapacity: 40, createdAt: "2026-09-01T10:15:00" },
  { queueId: "q5", orgId: "o1", name: "Career Services", description: "Resume reviews and interview prep", expectedDurationMinutes: 30, priorityLevel: "LOW", isActive: true, isOpen: true, maxCapacity: 20, createdAt: "2026-09-01T10:20:00" },
  { queueId: "q6", orgId: "o2", name: "Equipment Checkout", description: "Borrow gym and sports equipment", expectedDurationMinutes: 5, priorityLevel: "MEDIUM", isActive: true, isOpen: true, maxCapacity: 25, createdAt: "2026-09-06T10:00:00" },
  { queueId: "q7", orgId: "o2", name: "Intramural Sign-Up", description: "Register a team for intramural sports", expectedDurationMinutes: 8, priorityLevel: "LOW", isActive: true, isOpen: false, maxCapacity: 40, createdAt: "2026-09-06T10:05:00" },
];

export const mockCustomRoles: CustomRole[] = [
  { roleId: "r1", queueId: "q1", name: "Graduating Senior", priorityWeight: 5 },
  { roleId: "r2", queueId: "q1", name: "Walk-in", priorityWeight: 0 },
  { roleId: "r3", queueId: "q1", name: "Has Appointment", priorityWeight: 8 },
  { roleId: "r4", queueId: "q2", name: "Emergency Aid", priorityWeight: 10 },
  { roleId: "r5", queueId: "q2", name: "Standard", priorityWeight: 0 },
  { roleId: "r6", queueId: "q4", name: "Graduating Senior", priorityWeight: 5 },
  { roleId: "r7", queueId: "q5", name: "Alumni", priorityWeight: 2 },
  { roleId: "r8", queueId: "q6", name: "Staff", priorityWeight: 5 },
];

export const mockQueueEntries: QueueEntry[] = [
  // Active: General Advising (q1)
  { entryId: "e1", userId: "u3", queueId: "q1", joinedAt: "2026-10-05T09:30:00", endedAt: null, status: "WAITING", roleIds: ["r2"] },
  { entryId: "e2", userId: "u4", queueId: "q1", joinedAt: "2026-10-05T09:40:00", endedAt: null, status: "WAITING", roleIds: ["r1"] },
  { entryId: "e3", userId: "u5", queueId: "q1", joinedAt: "2026-10-05T09:50:00", endedAt: null, status: "WAITING", roleIds: ["r2"] },
  { entryId: "e7", userId: "u8", queueId: "q1", joinedAt: "2026-10-05T10:00:00", endedAt: null, status: "WAITING", roleIds: ["r2"] },
  { entryId: "e8", userId: "u9", queueId: "q1", joinedAt: "2026-10-05T10:05:00", endedAt: null, status: "WAITING", roleIds: ["r2"] },
  // Active: Financial Aid (q2). Casey has the Emergency Aid role, so she goes first.
  { entryId: "e9", userId: "u10", queueId: "q2", joinedAt: "2026-10-05T10:15:00", endedAt: null, status: "WAITING", roleIds: ["r5"] },
  { entryId: "e10", userId: "u5", queueId: "q2", joinedAt: "2026-10-05T10:20:00", endedAt: null, status: "WAITING", roleIds: ["r4"] },
  // Active: Registrar (q4). Jordan joined later but is a Graduating Senior.
  { entryId: "e12", userId: "u10", queueId: "q4", joinedAt: "2026-10-05T08:50:00", endedAt: null, status: "WAITING", roleIds: [] },
  { entryId: "e11", userId: "u4", queueId: "q4", joinedAt: "2026-10-05T09:00:00", endedAt: null, status: "WAITING", roleIds: ["r6"] },
  // Being served right now: Devon is the Current User at the Registrar (q4).
  { entryId: "e23", userId: "u9", queueId: "q4", joinedAt: "2026-10-05T08:30:00", endedAt: null, status: "SERVING", roleIds: [] },
  // Active: Career Services (q5). Elena is Alumni, so she goes first.
  { entryId: "e14", userId: "u9", queueId: "q5", joinedAt: "2026-10-05T08:45:00", endedAt: null, status: "WAITING", roleIds: [] },
  { entryId: "e13", userId: "u8", queueId: "q5", joinedAt: "2026-10-05T09:00:00", endedAt: null, status: "WAITING", roleIds: ["r7"] },
  // Active: Equipment Checkout (q6)
  { entryId: "e15", userId: "u3", queueId: "q6", joinedAt: "2026-10-05T11:00:00", endedAt: null, status: "WAITING", roleIds: [] },
  { entryId: "e16", userId: "u10", queueId: "q6", joinedAt: "2026-10-05T11:05:00", endedAt: null, status: "WAITING", roleIds: ["r8"] },
  // Past visits (these are the history)
  { entryId: "e4", userId: "u3", queueId: "q2", joinedAt: "2026-09-28T13:00:00", endedAt: "2026-09-28T13:35:00", status: "COMPLETED", roleIds: [] },
  { entryId: "e5", userId: "u3", queueId: "q3", joinedAt: "2026-09-21T09:10:00", endedAt: "2026-09-21T09:45:00", status: "CANCELLED", roleIds: [] },
  { entryId: "e6", userId: "u3", queueId: "q1", joinedAt: "2026-09-09T11:00:00", endedAt: "2026-09-09T11:20:00", status: "REMOVED", roleIds: [] },
  { entryId: "e17", userId: "u4", queueId: "q1", joinedAt: "2026-09-30T10:00:00", endedAt: "2026-09-30T10:25:00", status: "COMPLETED", roleIds: ["r1"] },
  { entryId: "e18", userId: "u8", queueId: "q2", joinedAt: "2026-09-29T14:00:00", endedAt: "2026-09-29T14:40:00", status: "COMPLETED", roleIds: ["r5"] },
  { entryId: "e19", userId: "u9", queueId: "q5", joinedAt: "2026-09-22T15:00:00", endedAt: "2026-09-22T15:10:00", status: "CANCELLED", roleIds: [] },
  { entryId: "e20", userId: "u5", queueId: "q4", joinedAt: "2026-09-18T12:00:00", endedAt: "2026-09-18T12:30:00", status: "REMOVED", roleIds: [] },
  { entryId: "e21", userId: "u10", queueId: "q6", joinedAt: "2026-09-25T16:00:00", endedAt: "2026-09-25T16:08:00", status: "COMPLETED", roleIds: [] },
  { entryId: "e22", userId: "u8", queueId: "q1", joinedAt: "2026-09-15T09:00:00", endedAt: "2026-09-15T09:20:00", status: "COMPLETED", roleIds: ["r3"] },
];

export const mockAdminPermissions: AdminPermission[] = [
  { permissionId: "p1", userId: "u2", queueId: "q1", canApproveEntries: true, canAssignRoles: true, canCreateRoles: false, canCreateLinks: true, canOverrideMessages: false },
  { permissionId: "p2", userId: "u2", queueId: "q2", canApproveEntries: true, canAssignRoles: false, canCreateRoles: false, canCreateLinks: false, canOverrideMessages: false },
  { permissionId: "p3", userId: "u2", queueId: "q4", canApproveEntries: true, canAssignRoles: true, canCreateRoles: true, canCreateLinks: true, canOverrideMessages: false },
  { permissionId: "p4", userId: "u7", queueId: "q6", canApproveEntries: true, canAssignRoles: false, canCreateRoles: false, canCreateLinks: false, canOverrideMessages: false },
  { permissionId: "p5", userId: "u7", queueId: "q7", canApproveEntries: true, canAssignRoles: true, canCreateRoles: true, canCreateLinks: true, canOverrideMessages: true },
];

export const mockNotifications: AppNotification[] = [
  { notificationId: "n1", userId: "u3", entryId: "e1", type: "QUEUE_UPDATE", message: "You joined the General Advising queue", isRead: true, createdAt: "2026-10-05T09:30:00" },
  { notificationId: "n2", userId: "u3", entryId: "e1", type: "QUEUE_UPDATE", message: "Your position is 2 in General Advising", isRead: false, createdAt: "2026-10-05T09:50:00" },
  { notificationId: "n3", userId: "u3", entryId: "e4", type: "STATUS_CHANGE", message: "You were served at Financial Aid", isRead: true, createdAt: "2026-09-28T13:35:00" },
  { notificationId: "n4", userId: "u3", entryId: "e15", type: "QUEUE_UPDATE", message: "You joined the Equipment Checkout queue", isRead: false, createdAt: "2026-10-05T11:00:00" },
  { notificationId: "n5", userId: "u4", entryId: "e2", type: "QUEUE_UPDATE", message: "You joined the General Advising queue", isRead: true, createdAt: "2026-10-05T09:40:00" },
  { notificationId: "n6", userId: "u4", entryId: "e2", type: "STATUS_CHANGE", message: "You're next in line for General Advising", isRead: false, createdAt: "2026-10-05T10:10:00" },
  { notificationId: "n7", userId: "u5", entryId: "e10", type: "QUEUE_UPDATE", message: "You joined the Financial Aid queue", isRead: true, createdAt: "2026-10-05T10:20:00" },
  { notificationId: "n8", userId: "u5", entryId: "e10", type: "STATUS_CHANGE", message: "You're next in line for Financial Aid", isRead: false, createdAt: "2026-10-05T10:21:00" },
  { notificationId: "n9", userId: "u10", entryId: "e9", type: "QUEUE_UPDATE", message: "Your position is 2 in Financial Aid", isRead: false, createdAt: "2026-10-05T10:21:00" },
  { notificationId: "n10", userId: "u8", entryId: "e18", type: "STATUS_CHANGE", message: "You were served at Financial Aid", isRead: true, createdAt: "2026-09-29T14:40:00" },
  { notificationId: "n12", userId: "u9", entryId: "e23", type: "STATUS_CHANGE", message: "It's your turn at the Registrar", isRead: false, createdAt: "2026-10-05T08:55:00" },
  { notificationId: "n11", userId: "u9", entryId: "e19", type: "QUEUE_UPDATE", message: "You left the Career Services queue", isRead: true, createdAt: "2026-09-22T15:10:00" },
];