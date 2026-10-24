import { describe, expect, it } from "vitest";
import { toCurrentEntry, toHistoryItem, toNotification } from "./apiMappers";

describe("apiMappers", () => {
  it("maps notifications to the screen shape", () => {
    const n = toNotification({ notificationId: "n1", type: "STATUS_CHANGE", message: "hi", isRead: false, createdAt: "2026-10-05T09:00:00" });
    expect(n).toEqual({ id: "n1", message: "hi", type: "status_change", read: false, timestamp: "2026-10-05T09:00:00" });
    expect(toNotification({ notificationId: "n2", type: "QUEUE_UPDATE", message: "x", isRead: true, createdAt: "t" }).type).toBe("queue_update");
  });
  it("maps history items and uses endedAt, then joinedAt", () => {
    const base = { entry: { entryId: "e4", joinedAt: "2026-09-28T13:00:00", endedAt: "2026-09-28T13:35:00" }, queue: { queueId: "q2", name: "Financial Aid" }, outcome: "served" as const };
    expect(toHistoryItem(base)).toEqual({ id: "e4", date: "2026-09-28", serviceName: "Financial Aid", outcome: "served" });
    const noEnd = toHistoryItem({ ...base, entry: { ...base.entry, endedAt: null, joinedAt: "2026-09-01T10:00:00" }, queue: null });
    expect(noEnd.date).toBe("2026-09-01");
    expect(noEnd.serviceName).toBe("Unknown service");
  });
  it("maps the current entry for waiting, almost ready, and being served", () => {
    const wait = toCurrentEntry({ entry: { entryId: "e1", queueId: "q1", status: "WAITING" }, queue: { queueId: "q1", name: "Advising" }, position: 4, almostReady: false, estimatedWaitMinutes: 45 });
    expect(wait.entry).toMatchObject({ status: "waiting", position: 4, estimatedWaitMinutes: 45, serviceId: "q1" });
    expect(wait.serviceName).toBe("Advising");
    const near = toCurrentEntry({ entry: { entryId: "e1", queueId: "q1", status: "WAITING" }, queue: null, position: null, almostReady: true, estimatedWaitMinutes: null });
    expect(near.entry).toMatchObject({ status: "almost_ready", position: 1, estimatedWaitMinutes: 0 });
    expect(near.serviceName).toBe("Your queue");
    const serving = toCurrentEntry({ entry: { entryId: "e23", queueId: "q4", status: "SERVING" }, queue: null, position: null, almostReady: false, estimatedWaitMinutes: null });
    expect(serving.entry).toMatchObject({ status: "almost_ready", position: 1, estimatedWaitMinutes: 0 });
  });
});

import { toService } from "./apiMappers";

describe("toService", () => {
  const q = { queueId: "q1", name: "Advising", description: "d", expectedDurationMinutes: 15, priorityLevel: "HIGH" as const, isOpen: true, isFull: false, queueLength: 5, estimatedWaitMinutes: 75 };
  it("maps a queue to the join screen's service", () => {
    expect(toService(q)).toEqual({ id: "q1", name: "Advising", description: "d", expectedDurationMinutes: 15, priority: "high", estimatedWaitMinutes: 75, queueLength: 5, isOpen: true });
  });
  it("shows a full or closed queue as closed", () => {
    expect(toService({ ...q, isFull: true }).isOpen).toBe(false);
    expect(toService({ ...q, isOpen: false }).isOpen).toBe(false);
  });
});
