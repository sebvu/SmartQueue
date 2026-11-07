import { ApiError } from "./http";
import * as repo from "./repo";
import type { AppNotification } from "./types";

// A user's notifications. Everything is scoped to the userId, so nobody can see or change someone else's.

// Newest first.
export function listNotifications(userId: string): AppNotification[] {
  return repo.listNotificationsForUser(userId);
}

// A missing notification and someone else's notification both give 404, so ids can't be probed.
export function setNotificationRead(userId: string, notificationId: string, isRead: boolean): AppNotification {
  if (!repo.findNotification(userId, notificationId)) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found.");
  }
  repo.setNotificationStatus(userId, notificationId, isRead);
  return repo.findNotification(userId, notificationId)!;
}

export function markAllNotificationsRead(userId: string): { updated: number } {
  return { updated: repo.markAllNotificationsViewed(userId) };
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
  repo.insertNotification(created);
  return created;
}
