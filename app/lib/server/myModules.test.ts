/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from "vitest";
import { GET as entriesGet } from "@/app/api/me/entries/route";
import { GET as historyGet } from "@/app/api/me/history/route";
import { GET as listGet } from "@/app/api/me/notifications/route";
import { PATCH as markPatch } from "@/app/api/me/notifications/[id]/route";
import { POST as readAllPost } from "@/app/api/me/notifications/read-all/route";
import { createSession } from "./auth";
import { getMyCurrentEntries, getMyHistory } from "./myEntriesService";
import { addNotification, listNotifications, markAllNotificationsRead, setNotificationRead } from "./notificationService";
import { getStore, resetStore } from "./store";

const as = (userId: string, init: RequestInit = {}) =>
  new Request("http://x/api", {
    ...init,
    headers: { authorization: `Bearer ${createSession(userId)}`, "content-type": "application/json" },
  });
const json = async (r: Response) => (await r.json()) as any;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => resetStore());

describe("notificationService", () => {
  it("lists only my notifications, newest first", () => {
    const list = listNotifications("u3");
    expect(list.map((n) => n.notificationId)).toEqual(["n4", "n2", "n1", "n3"]);
    expect(list.every((n) => n.userId === "u3")).toBe(true);
    expect(listNotifications("u2")).toEqual([]);
  });
  it("marks one notification read or unread", () => {
    expect(setNotificationRead("u3", "n2", true).isRead).toBe(true);
    expect(setNotificationRead("u3", "n2", false).isRead).toBe(false);
  });
  it("404s for missing or someone else's notification", () => {
    expect(() => setNotificationRead("u3", "nope", true)).toThrowError(/not found/);
    expect(() => setNotificationRead("u3", "n5", true)).toThrowError(/not found/);
    expect(getStore().notifications.find((n) => n.notificationId === "n5")!.isRead).toBe(true);
  });
  it("marks all read and counts what changed", () => {
    expect(markAllNotificationsRead("u3")).toEqual({ updated: 2 });
    expect(markAllNotificationsRead("u3")).toEqual({ updated: 0 });
    expect(getStore().notifications.find((n) => n.notificationId === "n6")!.isRead).toBe(false);
  });
  it("addNotification creates an unread one for the user", () => {
    const n = addNotification("u3", "e1", "STATUS_CHANGE", "Hello");
    expect(n.isRead).toBe(false);
    expect(listNotifications("u3")[0].notificationId).toBe(n.notificationId);
    expect(addNotification("u3", null, "QUEUE_UPDATE", "x").entryId).toBeNull();
  });
});

describe("myEntriesService", () => {
  it("returns current entries with position and wait", () => {
    const entries = getMyCurrentEntries("u3");
    expect(entries.map((e) => e.entry.entryId)).toEqual(["e15", "e1"]);
    const advising = entries.find((e) => e.entry.entryId === "e1")!;
    expect(advising.position).toBe(2);
    expect(advising.almostReady).toBe(true);
    expect(advising.queue?.name).toBeTruthy();
    expect(advising.estimatedWaitMinutes).toBeGreaterThan(0);
  });
  it("shows the person being served with no position", () => {
    const serving = getMyCurrentEntries("u9").find((e) => e.entry.status === "SERVING")!;
    expect(serving.position).toBeNull();
    expect(serving.almostReady).toBe(false);
    expect(serving.estimatedWaitMinutes).toBeNull();
  });
  it("treats FIRST_IN_LINE as position 1 and handles a missing queue", () => {
    const e = getStore().queueEntries.find((x) => x.entryId === "e1")!;
    e.status = "FIRST_IN_LINE";
    const mine = getMyCurrentEntries("u3").find((x) => x.entry.entryId === "e1")!;
    expect(mine.position).toBe(1);
    expect(mine.almostReady).toBe(true);
    getStore().queues = getStore().queues.filter((q) => q.queueId !== "q1");
    const orphan = getMyCurrentEntries("u3").find((x) => x.entry.entryId === "e1")!;
    expect(orphan.queue).toBeNull();
    expect(orphan.estimatedWaitMinutes).toBeNull();
  });
  it("returns history, latest first, with outcomes", () => {
    const history = getMyHistory("u3");
    expect(history.map((h) => [h.entry.entryId, h.outcome])).toEqual([
      ["e4", "served"],
      ["e5", "left"],
      ["e6", "removed"],
    ]);
    expect(history[0].queue?.name).toBeTruthy();
  });
  it("history falls back to joinedAt and tolerates a missing queue", () => {
    const e = getStore().queueEntries.find((x) => x.entryId === "e4")!;
    e.endedAt = null;
    e.queueId = "gone";
    const h = getMyHistory("u3").find((x) => x.entry.entryId === "e4")!;
    expect(h.queue).toBeNull();
  });
  it("gives nothing to a user with no entries", () => {
    expect(getMyCurrentEntries("u2")).toEqual([]);
    expect(getMyHistory("u2")).toEqual([]);
  });
});

describe("/api/me routes", () => {
  it("require login", async () => {
    const anon = new Request("http://x/api");
    for (const res of [await entriesGet(anon), await historyGet(anon), await listGet(anon), await readAllPost(anon)]) {
      expect(res.status).toBe(401);
      expect((await json(res)).error.code).toBe("UNAUTHENTICATED");
    }
    const patch = await markPatch(new Request("http://x", { method: "PATCH", body: "{}" }), ctx("n1"));
    expect(patch.status).toBe(401);
  });
  it("GET entries and history", async () => {
    const e = await json(await entriesGet(as("u3")));
    expect(e.data).toHaveLength(2);
    const h = await json(await historyGet(as("u3")));
    expect(h.data).toHaveLength(3);
  });
  it("GET notifications", async () => {
    const res = await json(await listGet(as("u3")));
    expect(res.data).toHaveLength(4);
  });
  it("PATCH marks read, validates the body, and 404s for others", async () => {
    const ok = await markPatch(as("u3", { method: "PATCH", body: JSON.stringify({ isRead: true }) }), ctx("n2"));
    expect(ok.status).toBe(200);
    expect((await json(ok)).data.isRead).toBe(true);
    const bad = await markPatch(as("u3", { method: "PATCH", body: JSON.stringify({}) }), ctx("n2"));
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.fields.isRead).toBeTruthy();
    const badJson = await markPatch(as("u3", { method: "PATCH", body: "{" }), ctx("n2"));
    expect((await json(badJson)).error.code).toBe("INVALID_JSON");
    const other = await markPatch(as("u3", { method: "PATCH", body: JSON.stringify({ isRead: true }) }), ctx("n5"));
    expect(other.status).toBe(404);
  });
  it("POST read-all", async () => {
    const res = await json(await readAllPost(as("u3", { method: "POST" })));
    expect(res.data).toEqual({ updated: 2 });
  });
});
