import { ApiError } from "./http";
import { getStore } from "./store";
import type { AppNotification } from "./types";

// A user's notifications. Everything is scoped to the userId, so nobody can see or change someone else's.

// Newest first.
export function listNotifications(userId: string): AppNotification[] {
  return getStore()
    .notifications.filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// A missing notification and someone else's notification both give 404, so ids can't be probed.
export function setNotificationRead(userId: string, notificationId: string, isRead: boolean): AppNotification {
  const found = getStore().notifications.find(
    (n) => n.notificationId === notificationId && n.userId === userId
  );
  if (!found) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
  found.isRead = isRead;
  return found;
}

export function markAllNotificationsRead(userId: string): { updated: number } {
  let updated = 0;
  for (const n of getStore().notifications) {
    if (n.userId === userId && !n.isRead) {
      n.isRead = true;
      updated += 1;
    }
  }
  return { updated };
}

// Used by other modules (join, serve next, remove) to tell a user something happened.
export function addNotification(
  userId: string,
  entryId: string | null,
  type: AppNotification["type"],
  message: string
): AppNotification {
  const created: AppNotification = {
    notificationId: crypto.randomUUID(),
    userId,
    entryId,
    type,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  getStore().notifications.push(created);
  return created;
}
