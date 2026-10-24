import type { AppNotification, HistoryItem, QueueEntry, QueueStatus } from "./types";

// The API sends the server's field names (see app/lib/server/types.ts).
// The A2 screens use their own shapes (app/lib/types.ts). These functions translate.

export type ApiNotification = {
  notificationId: string;
  type: "QUEUE_UPDATE" | "STATUS_CHANGE";
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type ApiQueueSummary = { queueId: string; name: string } | null;

export type ApiMyEntry = {
  entry: { entryId: string; queueId: string; status: string };
  queue: ApiQueueSummary;
  position: number | null;
  almostReady: boolean;
  estimatedWaitMinutes: number | null;
};

export type ApiHistoryItem = {
  entry: { entryId: string; joinedAt: string; endedAt: string | null };
  queue: ApiQueueSummary;
  outcome: HistoryItem["outcome"];
};

export function toNotification(n: ApiNotification): AppNotification {
  return {
    id: n.notificationId,
    message: n.message,
    type: n.type === "STATUS_CHANGE" ? "status_change" : "queue_update",
    read: n.isRead,
    timestamp: n.createdAt,
  };
}

export function toHistoryItem(h: ApiHistoryItem): HistoryItem {
  return {
    id: h.entry.entryId,
    date: (h.entry.endedAt ?? h.entry.joinedAt).slice(0, 10),
    serviceName: h.queue?.name ?? "Unknown service",
    outcome: h.outcome,
  };
}

// The dashboard shows one entry. Being served right now counts as "almost_ready"
// (the screen's "head to the service area" message), with position 1 and no wait.
export function toCurrentEntry(e: ApiMyEntry): { entry: QueueEntry; serviceName: string } {
  const beingServed = e.entry.status === "SERVING";
  const status: QueueStatus = beingServed || e.almostReady ? "almost_ready" : "waiting";
  return {
    entry: {
      id: e.entry.entryId,
      serviceId: e.entry.queueId,
      position: beingServed ? 1 : (e.position ?? 1),
      estimatedWaitMinutes: beingServed ? 0 : (e.estimatedWaitMinutes ?? 0),
      status,
    },
    serviceName: e.queue?.name ?? "Your queue",
  };
}
