import { requireUser } from "./auth";
import { ApiError } from "./http";
import * as repo from "./repo";
import type { Organization, Queue, User } from "./types";

// Roles for a specific queue are worked out from the data (the account-level role, USER or ADMIN, is stored in user_credentials):
//   OWNER = owns the organization the queue belongs to (has every admin ability)
//   ADMIN = has an admin_permissions row for that queue
//   USER  = everyone else

export type QueueRole = "OWNER" | "ADMIN" | "USER";

export function getQueueRole(userId: string, queueId: string): QueueRole {
  const queue = repo.findQueue(queueId);
  if (!queue) return "USER";
  const organization = repo.findOrganization(queue.orgId);
  if (organization && organization.ownerId === userId) return "OWNER";
  if (repo.hasAdminPermission(userId, queueId)) return "ADMIN";
  return "USER";
}

export function getOwnedOrgIds(userId: string): string[] {
  return repo.listOwnedOrgIds(userId);
}

export function getAdminQueueIds(userId: string): string[] {
  return repo.listAdminQueueIds(userId);
}

// For endpoints only an owner or admin of this queue may use (view the queue, serve next, remove a user).
export function requireQueueAdmin(
  request: Request,
  queueId: string
): { user: User; queue: Queue; role: "OWNER" | "ADMIN" } {
  const user = requireUser(request);
  const queue = repo.findQueue(queueId);
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
  const organization = repo.findOrganization(orgId);
  if (!organization) throw new ApiError(404, "NOT_FOUND", "Organization not found.");
  if (organization.ownerId !== user.userId) {
    throw new ApiError(403, "FORBIDDEN", "Only the organization owner can do this.");
  }
  return { user, organization };
}
