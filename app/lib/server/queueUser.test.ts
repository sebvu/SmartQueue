/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from "vitest";
import { GET as listGet } from "@/app/api/queues/route";
import { GET as detailGet } from "@/app/api/queues/[queueId]/route";
import { POST as joinPost } from "@/app/api/queues/[queueId]/join/route";
import { POST as leavePost } from "@/app/api/queues/[queueId]/leave/route";
import { createSession } from "./auth";
import { listNotifications } from "./notificationService";
import { getQueueDetail, joinQueue, leaveQueue, listQueues } from "./queueUserService";
import { getStore, resetStore } from "./store";

const as = (userId: string) =>
  new Request("http://x/api", { method: "POST", headers: { authorization: `Bearer ${createSession(userId)}` } });
const ctx = (queueId: string) => ({ params: Promise.resolve({ queueId }) });
const json = async (r: Response) => (await r.json()) as any;
const entriesIn = (userId: string, queueId: string) =>
  getStore().queueEntries.filter((e) => e.userId === userId && e.queueId === queueId);

beforeEach(() => resetStore());

describe("listQueues and getQueueDetail", () => {
  it("lists only active queues, with length and wait, and flags full ones", () => {
    const list = listQueues();
    expect(list.some((q) => q.queueId === "q3")).toBe(false); // deactivated
    const q7 = list.find((q) => q.queueId === "q7");
    expect(q7?.isOpen).toBe(false); // closed but still listed
    const q1 = list.find((q) => q.queueId === "q1")!;
    expect(q1.queueLength).toBe(5);
    expect(q1.estimatedWaitMinutes).toBe(5 * q1.expectedDurationMinutes);
    expect(q1.isFull).toBe(false);
    const q4 = list.find((q) => q.queueId === "q4")!;
    expect(q4.estimatedWaitMinutes).toBe(3 * q4.expectedDurationMinutes); // 2 waiting + 1 being served
    getStore().queues.find((q) => q.queueId === "q1")!.maxCapacity = 5;
    expect(listQueues().find((q) => q.queueId === "q1")!.isFull).toBe(true);
  });
  it("shows my entry in the detail, or null", () => {
    expect(getQueueDetail("u3", "q1").myEntry?.position).toBe(2);
    expect(getQueueDetail("u2", "q1").myEntry).toBeNull();
    expect(() => getQueueDetail("u3", "q3")).toThrowError(/not found/);
    expect(() => getQueueDetail("u3", "nope")).toThrowError(/not found/);
  });
});

describe("joinQueue", () => {
  it("adds a waiting entry with no roles, and notifies the user", () => {
    const result = joinQueue("u2", "q1");
    expect(result.entry.status).toBe("WAITING");
    expect(result.entry.roleIds).toEqual([]);
    expect(result.position).toBe(6);
    const messages = listNotifications("u2").map((n) => n.message);
    expect(messages).toContain("You joined the General Advising queue");
    expect(messages).toContain("Your position is 6 in General Advising");
  });
  it("refuses a closed, missing, full, or already joined queue", () => {
    expect(() => joinQueue("u2", "q7")).toThrowError(/closed/);
    expect(() => joinQueue("u2", "q3")).toThrowError(/not found/);
    expect(() => joinQueue("u3", "q1")).toThrowError(/already/);
    getStore().queues.find((q) => q.queueId === "q2")!.maxCapacity = 2;
    expect(() => joinQueue("u2", "q2")).toThrowError(/full/);
  });
  it("lets a person rejoin after leaving", () => {
    leaveQueue("u3", "q1");
    expect(joinQueue("u3", "q1").entry.status).toBe("WAITING");
    expect(entriesIn("u3", "q1").length).toBeGreaterThan(2);
  });
});

describe("leaveQueue", () => {
  it("cancels the entry, ends it, and notifies", () => {
    const entry = leaveQueue("u3", "q1");
    expect(entry.status).toBe("CANCELLED");
    expect(entry.endedAt).not.toBeNull();
    expect(listNotifications("u3")[0].message).toBe("You left the General Advising queue");
  });
  it("404s if not in the queue, and refuses while being served", () => {
    expect(() => leaveQueue("u2", "q1")).toThrowError(/not in this queue/);
    expect(() => leaveQueue("u9", "q4")).toThrowError(/being served/);
  });
  it("still notifies if the queue record is gone", () => {
    getStore().queues = getStore().queues.filter((q) => q.queueId !== "q6");
    expect(leaveQueue("u3", "q6").status).toBe("CANCELLED");
    expect(listNotifications("u3")[0].message).toBe("You left the queue queue");
  });
});

describe("/api/queues routes", () => {
  it("require login", async () => {
    const anon = new Request("http://x/api", { method: "POST" });
    for (const res of [await listGet(anon), await detailGet(anon, ctx("q1")), await joinPost(anon, ctx("q1")), await leavePost(anon, ctx("q1"))]) {
      expect(res.status).toBe(401);
    }
  });
  it("list, detail, join, and leave work end to end", async () => {
    expect((await json(await listGet(as("u2")))).data.length).toBe(6);
    expect((await json(await detailGet(as("u3"), ctx("q1")))).data.myEntry.position).toBe(2);
    const joined = await joinPost(as("u2"), ctx("q1"));
    expect(joined.status).toBe(201);
    const again = await joinPost(as("u2"), ctx("q1"));
    expect(again.status).toBe(409);
    expect((await json(again)).error.code).toBe("ALREADY_IN_QUEUE");
    const left = await leavePost(as("u2"), ctx("q1"));
    expect((await json(left)).data.status).toBe("CANCELLED");
    expect((await leavePost(as("u2"), ctx("q1"))).status).toBe(404);
  });
});
