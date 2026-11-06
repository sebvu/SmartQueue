import { ApiError } from "./http";
import { addNotification } from "./notificationService";
import { CURRENT_STATUSES, toMyEntry, type MyEntry } from "./myEntriesService";
import { countActiveEntries } from "./queueLogic";
import * as repo from "./repo";
import { generateId } from "./store";
import type { Queue, QueueEntry } from "./types";

// What a signed-in user can do with queues: browse them, join one, and leave one.

export type QueueListItem = Queue & {
  queueLength: number; // people waiting or being served
  estimatedWaitMinutes: number; // for someone who joins now
  isFull: boolean;
};

export type QueueDetail = QueueListItem & { myEntry: MyEntry | null };

function findActiveQueue(queueId: string): Queue {
  const queue = repo.findQueue(queueId);
  if (!queue || !queue.isActive) throw new ApiError(404, "NOT_FOUND", "Queue not found.");
  return queue;
}

function withStats(queue: Queue): QueueListItem {
  const waiting = repo.countEntries(queue.queueId, ["WAITING"]);
  const serving = repo.countEntries(queue.queueId, ["SERVING"]) > 0;
  const queueLength = countActiveEntries(queue.queueId);
  return {
    ...queue,
    queueLength,
    estimatedWaitMinutes: (waiting + (serving ? 1 : 0)) * queue.expectedDurationMinutes,
    isFull: queueLength >= queue.maxCapacity,
  };
}

function myActiveEntry(userId: string, queueId: string): QueueEntry | undefined {
  return repo.findActiveEntry(userId, queueId, CURRENT_STATUSES) ?? undefined;
}

// Deactivated queues are hidden. Closed queues are still listed (isOpen = false).
export function listQueues(): QueueListItem[] {
  return repo.listQueues({ activeOnly: true }).map(withStats);
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
  repo.insertEntry(entry);
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
  const left = repo.setEntryStatus(entry.entryId, "CANCELLED", new Date().toISOString())!;
  const queue = repo.findQueue(queueId);
  addNotification(userId, entry.entryId, "QUEUE_UPDATE", `You left the ${queue?.name ?? "queue"} queue`);
  return left;
}
