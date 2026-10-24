import { estimateWaitMinutes, getPosition, isAlmostReady } from "./queueLogic";
import { getStore } from "./store";
import type { EntryStatus, Queue, QueueEntry } from "./types";

// The signed-in user's own queue entries: where they are now, and what already ended.

const HISTORY_STATUSES: EntryStatus[] = ["COMPLETED", "CANCELLED", "REMOVED"];
export const CURRENT_STATUSES: EntryStatus[] = [
  "PENDING_APPROVAL",
  "WAITLISTED",
  "WAITING",
  "FIRST_IN_LINE",
  "SERVING",
  "VERIFIED",
];

export type QueueSummary = Pick<Queue, "queueId" | "name" | "expectedDurationMinutes" | "isOpen" | "isActive">;

export type MyEntry = {
  entry: QueueEntry;
  queue: QueueSummary | null;
  position: number | null; // 1 = next up. null if not in the waiting line (for example SERVING)
  almostReady: boolean;
  estimatedWaitMinutes: number | null;
};

function summarize(queue: Queue | undefined): QueueSummary | null {
  if (!queue) return null;
  const { queueId, name, expectedDurationMinutes, isOpen, isActive } = queue;
  return { queueId, name, expectedDurationMinutes, isOpen, isActive };
}

function forUser(userId: string, statuses: EntryStatus[]): QueueEntry[] {
  return getStore().queueEntries.filter((e) => e.userId === userId && statuses.includes(e.status));
}

// One entry with its queue summary, position, and wait estimate.
export function toMyEntry(entry: QueueEntry): MyEntry {
  const queue = getStore().queues.find((q) => q.queueId === entry.queueId);
  return {
    entry,
    queue: summarize(queue),
    position: entry.status === "FIRST_IN_LINE" ? 1 : getPosition(entry),
    almostReady: entry.status === "FIRST_IN_LINE" || isAlmostReady(entry),
    estimatedWaitMinutes: queue ? estimateWaitMinutes(entry, queue) : null,
  };
}

// Entries the user is still in, newest join first.
export function getMyCurrentEntries(userId: string): MyEntry[] {
  return forUser(userId, CURRENT_STATUSES)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    .map(toMyEntry);
}

export type HistoryItem = {
  entry: QueueEntry;
  queue: QueueSummary | null;
  outcome: "served" | "left" | "removed";
};

const OUTCOME = { COMPLETED: "served", CANCELLED: "left", REMOVED: "removed" } as const;

// Finished entries, most recently ended first.
export function getMyHistory(userId: string): HistoryItem[] {
  const queues = getStore().queues;
  const key = (e: QueueEntry) => e.endedAt ?? e.joinedAt;
  return forUser(userId, HISTORY_STATUSES)
    .sort((a, b) => key(b).localeCompare(key(a)))
    .map((entry) => ({
      entry,
      queue: summarize(queues.find((q) => q.queueId === entry.queueId)),
      outcome: OUTCOME[entry.status as keyof typeof OUTCOME],
    }));
}
