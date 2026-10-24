import { ApiError } from "./http";
import { addNotification } from "./notificationService";
import { CURRENT_STATUSES, toMyEntry, type MyEntry } from "./myEntriesService";
import { countActiveEntries } from "./queueLogic";
import { generateId, getStore } from "./store";
import type { Queue, QueueEntry } from "./types";

// What a signed-in user can do with queues: browse them, join one, and leave one.

export type QueueListItem = Queue & {
  queueLength: number; // people waiting or being served
  estimatedWaitMinutes: number; // for someone who joins now
  isFull: boolean;
};

export type QueueDetail = QueueListItem & { myEntry: MyEntry | null };

function findActiveQueue(queueId: string): Queue {
  const queue = getStore().queues.find((q) => q.queueId === queueId && q.isActive);
  if (!queue) throw new ApiError(404, "NOT_FOUND", "Queue not found.");
  return queue;
}

function withStats(queue: Queue): QueueListItem {
  const store = getStore();
  const waiting = store.queueEntries.filter((e) => e.queueId === queue.queueId && e.status === "WAITING").length;
  const serving = store.queueEntries.some((e) => e.queueId === queue.queueId && e.status === "SERVING");
  const queueLength = countActiveEntries(queue.queueId);
  return {
    ...queue,
    queueLength,
    estimatedWaitMinutes: (waiting + (serving ? 1 : 0)) * queue.expectedDurationMinutes,
    isFull: queueLength >= queue.maxCapacity,
  };
}

function myActiveEntry(userId: string, queueId: string): QueueEntry | undefined {
  return getStore().queueEntries.find(
    (e) => e.userId === userId && e.queueId === queueId && CURRENT_STATUSES.includes(e.status)
  );
}

// Deactivated queues are hidden. Closed queues are still listed (isOpen = false).
export function listQueues(): QueueListItem[] {
  return getStore()
    .queues.filter((q) => q.isActive)
    .map(withStats);
}

export function getQueueDetail(userId: string, queueId: string): QueueDetail {
  const queue = findActiveQueue(queueId);
  const mine = myActiveEntry(userId, queueId);
  return { ...withStats(queue), myEntry: mine ? toMyEntry(mine) : null };
}

export function joinQueue(userId: string, queueId: string): MyEntry {
  const queue = findActiveQueue(queueId);
  if (!queue.isOpen) throw new ApiError(409, "QUEUE_CLOSED", "This queue is closed right now.");
  if (myActiveEntry(userId, queueId)) {
    throw new ApiError(409, "ALREADY_IN_QUEUE", "You are already in this queue.");
  }
  if (countActiveEntries(queueId) >= queue.maxCapacity) {
    throw new ApiError(409, "QUEUE_FULL", "This queue is full.");
  }
  const entry: QueueEntry = {
    entryId: generateId(),
    userId,
    queueId,
    joinedAt: new Date().toISOString(),
    endedAt: null,
    status: "WAITING",
    roleIds: [], // only staff can assign roles, so a person cannot pick their own priority
  };
  getStore().queueEntries.push(entry);
  const result = toMyEntry(entry);
  addNotification(userId, entry.entryId, "QUEUE_UPDATE", `You joined the ${queue.name} queue`);
  addNotification(userId, entry.entryId, "QUEUE_UPDATE", `Your position is ${result.position} in ${queue.name}`);
  return result;
}

export function leaveQueue(userId: string, queueId: string): QueueEntry {
  const entry = myActiveEntry(userId, queueId);
  if (!entry) throw new ApiError(404, "NOT_FOUND", "You are not in this queue.");
  if (entry.status === "SERVING") {
    throw new ApiError(409, "CONFLICT", "You are being served right now, so you cannot leave.");
  }
  entry.status = "CANCELLED";
  entry.endedAt = new Date().toISOString();
  const queue = getStore().queues.find((q) => q.queueId === queueId);
  addNotification(userId, entry.entryId, "QUEUE_UPDATE", `You left the ${queue?.name ?? "queue"} queue`);
  return entry;
}
