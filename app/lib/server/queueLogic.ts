import { ALMOST_READY_MAX_POSITION } from "./config";
import { getStore } from "./store";
import type { Queue, QueueEntry } from "./types";

// Shared queue rules. Position is worked out, never stored.
// Order: highest role priorityWeight first, then earliest joinedAt.

// Statuses that count as "still in the queue" (the person has not finished or left).
export const ACTIVE_STATUSES = ["WAITING", "FIRST_IN_LINE", "SERVING"] as const;

export function entryWeight(entry: QueueEntry): number {
  const roles = getStore().customRoles;
  let weight = 0;
  for (const roleId of entry.roleIds) {
    const role = roles.find((r) => r.roleId === roleId);
    if (role && role.priorityWeight > weight) weight = role.priorityWeight;
  }
  return weight;
}

// WAITING entries for a queue, in the order they will be served.
export function getWaitingOrder(queueId: string): QueueEntry[] {
  return getStore()
    .queueEntries.filter((e) => e.queueId === queueId && e.status === "WAITING")
    .sort((a, b) => {
      const diff = entryWeight(b) - entryWeight(a);
      if (diff !== 0) return diff;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
}

// 1-based position among WAITING entries, or null if the entry is not waiting.
export function getPosition(entry: QueueEntry): number | null {
  const index = getWaitingOrder(entry.queueId).findIndex((e) => e.entryId === entry.entryId);
  return index === -1 ? null : index + 1;
}

export function isAlmostReady(entry: QueueEntry): boolean {
  const position = getPosition(entry);
  return position !== null && position <= ALMOST_READY_MAX_POSITION;
}

// Estimated minutes until this entry is served: everyone ahead, plus the current person, times the queue's duration.
export function estimateWaitMinutes(entry: QueueEntry, queue: Queue): number | null {
  const position = getPosition(entry);
  if (position === null) return null;
  const serving = getStore().queueEntries.some(
    (e) => e.queueId === queue.queueId && e.status === "SERVING"
  );
  return (position - 1 + (serving ? 1 : 0)) * queue.expectedDurationMinutes;
}

// Entries that currently occupy a spot (counts toward maxCapacity).
export function countActiveEntries(queueId: string): number {
  return getStore().queueEntries.filter(
    (e) => e.queueId === queueId && (ACTIVE_STATUSES as readonly string[]).includes(e.status)
  ).length;
}
