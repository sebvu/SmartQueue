import { ALMOST_READY_MAX_POSITION } from "./config";
import * as repo from "./repo";
import type { Queue, QueueEntry } from "./types";

// Shared queue rules.
// Order: highest role priorityWeight first, then earliest joinedAt.
// The ordering itself is done by the database (see WAITING_ORDER_SQL in db.ts).

// Statuses that count as "still in the queue" (the person has not finished or left).
export const ACTIVE_STATUSES = ["WAITING", "FIRST_IN_LINE", "SERVING"] as const;

export function entryWeight(entry: QueueEntry): number {
  const weights = repo.getRoleWeights(entry.queueId);
  let weight = 0;
  for (const roleId of entry.roleIds) {
    const w = weights.get(roleId);
    if (w !== undefined && w > weight) weight = w;
  }
  return weight;
}

// WAITING entries for a queue, in the order they will be served.
export function getWaitingOrder(queueId: string): QueueEntry[] {
  return repo.listWaitingOrdered(queueId);
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
  const serving = repo.countEntries(queue.queueId, ["SERVING"]) > 0;
  return (position - 1 + (serving ? 1 : 0)) * queue.expectedDurationMinutes;
}

// Entries that currently occupy a spot (counts toward maxCapacity).
export function countActiveEntries(queueId: string): number {
  return repo.countEntries(queueId, ACTIVE_STATUSES);
}
