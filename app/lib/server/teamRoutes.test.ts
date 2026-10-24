/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from "vitest";
import { POST as addQueuePost } from "@/app/api/addQueue/route";
import { PATCH as editQueuePatch } from "@/app/api/editQueue/route";
import { GET as getQueuesGet } from "@/app/api/getQueues/route";
import { GET as getSingleGet } from "@/app/api/getSingleQueue/route";
import { PATCH as serveUserPatch } from "@/app/api/serveUser/route";
import { GET as userAuthGet, POST as userAuthPost } from "@/app/api/userAuth/route";
import { GET as userQueueGet, PATCH as userQueuePatch, POST as userQueuePost } from "@/app/api/userQueue/route";
import { getStore, resetStore } from "./store";

// Tests for the team's route files. A GET handler is called with a POST request here,
// because the handlers read a JSON body and a GET request cannot carry one in Node.
const req = (body: unknown, url = "http://x/api") =>
  new Request(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const json = async (r: Response) => (await r.json()) as any;

beforeEach(() => resetStore());

describe("getQueues and getSingleQueue", () => {
  it("lists every queue", async () => {
    const res = await getQueuesGet(new Request("http://x/api"));
    expect(res.status).toBe(200);
    expect((await json(res)).length).toBe(getStore().queues.length);
  });
  it("returns one queue, or a clear error", async () => {
    expect((await json(await getSingleGet(req({ queueId: "q1" })))).name).toBe("General Advising");
    expect((await getSingleGet(req({}))).status).toBe(400);
    expect((await getSingleGet(req({ queueId: "nope" }))).status).toBe(400);
    expect((await getSingleGet(req("{"))).status).toBe(500);
  });
});

describe("addQueue and editQueue", () => {
  const newQueue = { queueId: "q99", orgId: "o1", name: "New", description: "d", expectedDurationMinutes: 10, priorityLevel: "LOW", maxCapacity: 5 };
  it("adds a queue that every other route can see", async () => {
    const res = await addQueuePost(req(newQueue));
    expect(res.status).toBe(201);
    expect(getStore().queues.some((q) => q.queueId === "q99" && q.isOpen && q.isActive)).toBe(true);
    expect((await json(await getSingleGet(req({ queueId: "q99" })))).name).toBe("New");
    expect((await addQueuePost(req("{"))).status).toBe(500);
  });
  it("edits only the fields that are sent", async () => {
    const res = await editQueuePatch(
      req({ queueId: "q1", name: "Renamed", description: "x", expectedDurationMinutes: 20, priorityLevel: "HIGH", isOpen: false, maxCapacity: 9 })
    );
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ name: "Renamed", description: "x", expectedDurationMinutes: 20, priorityLevel: "HIGH", isOpen: false, maxCapacity: 9 });
    const untouched = await editQueuePatch(req({ queueId: "q2" }));
    expect((await json(untouched)).name).toBe("Financial Aid");
  });
  it("404s for an unknown queue and 400s for bad JSON", async () => {
    expect((await editQueuePatch(req({ queueId: "nope" }))).status).toBe(404);
    expect((await editQueuePatch(req("{"))).status).toBe(400);
  });
});

describe("serveUser", () => {
  it("promotes the first waiting person to SERVING and completes the current one", async () => {
    const before = getStore().queueEntries.find((e) => e.status === "SERVING" && e.queueId === "q4")!;
    const res = await serveUserPatch(req({ queueId: "q4" }));
    expect(res.status).toBe(200);
    expect(before.status).toBe("COMPLETED");
    expect(before.endedAt).not.toBeNull();
    const served = await json(res);
    expect(served.userId).toBe("u4"); // first in q4's waiting order
    expect(served.status).toBe("SERVING");
  });
  it("serves from a queue with nobody at the counter", async () => {
    const res = await serveUserPatch(req({ queueId: "q1" }));
    expect((await json(res)).userId).toBe("u4");
  });
  it("rejects a missing queue id, an empty line, and bad JSON", async () => {
    expect((await serveUserPatch(req({}))).status).toBe(400);
    expect((await serveUserPatch(req({ queueId: "q7" }))).status).toBe(400);
    expect((await serveUserPatch(req("{"))).status).toBe(500);
  });
});

describe("userAuth", () => {
  const account = { username: "tester", email: " Tester@Example.com ", password: "secret123" };
  it("registers, refuses a duplicate, and rejects bad input", async () => {
    const res = await userAuthPost(req(account));
    expect(res.status).toBe(201);
    expect((await json(res)).email).toBe("tester@example.com");
    expect((await userAuthPost(req({ ...account, email: "sam@example.com" }))).status).toBe(409);
    expect((await userAuthPost(req({}))).status).toBe(400);
  });
  it("logs in with the email and password in the URL", async () => {
    await userAuthPost(req(account));
    const url = (e: string, p: string) => new Request(`http://x/api?email=${e}&password=${p}`);
    const ok = await userAuthGet(url("tester@example.com", "secret123"));
    expect(ok.status).toBe(200);
    expect((await json(ok)).exists).toBe(true);
    expect((await userAuthGet(url("tester@example.com", "wrong"))).status).toBe(401);
    expect((await userAuthGet(new Request("http://x/api?email=a@b.co"))).status).toBe(400);
  });
});

describe("userQueue (join, position, leave)", () => {
  it("joins a queue, and refuses a duplicate or a closed queue", async () => {
    const res = await userQueuePost(req({ userId: "u2", queueId: "q1", roleIds: [] }));
    expect(res.status).toBe(201);
    expect((await json(res)).status).toBe("WAITING");
    expect((await userQueuePost(req({ userId: "u2", queueId: "q1", roleIds: [] }))).status).toBe(409);
    expect((await userQueuePost(req({ userId: "u2", queueId: "q7", roleIds: [] }))).status).toBe(404);
    expect((await userQueuePost(req("{"))).status).toBe(500);
  });
  it("finds a position and handles a person who is not in the queue", async () => {
    const res = await userQueueGet(req({ userId: "u3", queueId: "q1" }));
    expect(await json(res)).toBe(2);
    expect((await userQueueGet(req({ userId: "u2", queueId: "q1" }))).status).toBe(500);
    expect((await userQueueGet(req("{"))).status).toBe(500);
  });
  it("leaves a queue, 404s if not in it, and 500s on bad JSON", async () => {
    const res = await userQueuePatch(req({ userId: "u3", queueId: "q1" }));
    expect(res.status).toBe(200);
    expect((await json(res)).status).toBe("CANCELLED");
    expect((await userQueuePatch(req({ userId: "u2", queueId: "q1" }))).status).toBe(404);
    expect((await userQueuePatch(req("{"))).status).toBe(500);
  });
});
