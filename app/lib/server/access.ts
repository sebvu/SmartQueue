import { requireUser } from "./auth";
import { ApiError } from "./http";
import { getStore } from "./store";
import type { Organization, Queue, User } from "./types";

// Roles are worked out, not stored:
//   OWNER = owns the organization the queue belongs to (has every admin ability)
//   ADMIN = has an admin_permissions row for that queue
//   USER  = everyone else

export type QueueRole = "OWNER" | "ADMIN" | "USER";

export function getQueueRole(userId: string, queueId: string): QueueRole {
  const store = getStore();
  const queue = store.queues.find((q) => q.queueId === queueId);
  if (!queue) return "USER";
  const organization = store.organizations.find((o) => o.orgId === queue.orgId);
  if (organization && organization.ownerId === userId) return "OWNER";
  if (store.adminPermissions.some((p) => p.userId === userId && p.queueId === queueId)) {
    return "ADMIN";
  }
  return "USER";
}

export function getOwnedOrgIds(userId: string): string[] {
  return getStore()
    .organizations.filter((o) => o.ownerId === userId)
    .map((o) => o.orgId);
}

export function getAdminQueueIds(userId: string): string[] {
  return getStore()
    .adminPermissions.filter((p) => p.userId === userId)
    .map((p) => p.queueId);
}

// For endpoints only an owner or admin of this queue may use (view the queue, serve next, remove a user).
export function requireQueueAdmin(
  request: Request,
  queueId: string
): { user: User; queue: Queue; role: "OWNER" | "ADMIN" } {
  const user = requireUser(request);
  const queue = getStore().queues.find((q) => q.queueId === queueId);
  if (!queue) throw new ApiError(404, "NOT_FOUND", "Queue not found.");
  const role = getQueueRole(user.userId, queueId);
  if (role === "USER") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to manage this queue.");
  }
  return { user, queue, role };
}

// For endpoints only the organization's owner may use (create queues, change settings).
export function requireOrgOwner(
  request: Request,
  orgId: string
): { user: User; organization: Organization } {
  const user = requireUser(request);
  const organization = getStore().organizations.find((o) => o.orgId === orgId);
  if (!organization) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  if (organization.ownerId !== user.userId) {
    throw new ApiError(403, "FORBIDDEN", "Only the organization owner can do this.");
  }
  return { user, organization };
}
