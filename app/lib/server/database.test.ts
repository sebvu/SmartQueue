/* eslint-disable @typescript-eslint/no-explicit-any */
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/me/profile/route";
import { GET as userAuthGet, POST as userAuthPost } from "@/app/api/userAuth/route";
import { POST as addQueuePost } from "@/app/api/addQueue/route";
import { PATCH as editQueuePatch } from "@/app/api/editQueue/route";
import { createSession } from "./auth";
import { getDb } from "./db";
import * as repo from "./repo";
import { SCHEMA_SQL } from "./schema";
import { resetStore } from "./store";

// Tests for the A4 database layer: the schema rules, the repository, and the profile endpoint.
const as = (userId: string, method = "GET", body?: unknown) =>
  new Request("http://x/api", {
    method,
    headers: { authorization: `Bearer ${createSession(userId)}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (r: Response) => (await r.json()) as any;
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const run = (sql: string, ...args: unknown[]) => getDb().prepare(sql).run(...args);

beforeEach(() => resetStore());

describe("schema file", () => {
  it("docs/schema.sql matches the schema the app uses", () => {
    const file = fs.readFileSync(path.join(process.cwd(), "docs", "schema.sql"), "utf8");
    expect(file).toBe(SCHEMA_SQL);
  });
  it("keeps data after the database is closed and opened again", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sq-")), "test.db");
    const first = new Database(file);
    first.exec(SCHEMA_SQL);
    first
      .prepare("INSERT INTO user_credentials (user_id, email, password_hash, created_at) VALUES ('a', 'a@b.co', 'x:y', 'now')")
      .run();
    first.close();
    const second = new Database(file);
    expect((second.prepare("SELECT email FROM user_credentials").get() as any).email).toBe("a@b.co");
    second.close();
  });
});

describe("database rules (validation at the database level)", () => {
  const user = (id: string, email: string, extra = "") =>
    run(
      `INSERT INTO user_credentials (user_id, email, password_hash, role, created_at) VALUES (?, ?, 'a:b', ?, 'now')${extra}`,
      id, email, "USER"
    );
  it("requires an email and keeps it unique, ignoring case", () => {
    expect(() => run("INSERT INTO user_credentials (user_id, password_hash, created_at) VALUES ('x', 'a:b', 'now')")).toThrow(/NOT NULL/);
    expect(() => user("x1", "SAM@example.com")).toThrow(/UNIQUE/);
    expect(() => user("x2", "a")).toThrow(/CHECK/); // too short
  });
  it("only allows known roles, and a password for GENERAL accounts", () => {
    expect(() => run("INSERT INTO user_credentials (user_id, email, password_hash, role, created_at) VALUES ('x', 'x@y.co', 'a:b', 'BOSS', 'now')")).toThrow(/CHECK/);
    expect(() => run("INSERT INTO user_credentials (user_id, email, password_hash, created_at) VALUES ('x', 'x@y.co', NULL, 'now')")).toThrow(/CHECK/);
  });
  it("limits lengths and checks types", () => {
    expect(() => run("UPDATE user_profile SET full_name = ? WHERE user_id = 'u3'", "x".repeat(101))).toThrow(/CHECK/);
    expect(() => run("UPDATE user_profile SET full_name = '' WHERE user_id = 'u3'")).toThrow(/CHECK/);
    expect(() => run("UPDATE service SET expected_duration_minutes = 0 WHERE service_id = 's1'")).toThrow(/CHECK/);
    expect(() => run("UPDATE service SET priority_level = 'URGENT' WHERE service_id = 's1'")).toThrow(/CHECK/);
    expect(() => run("UPDATE queue SET max_capacity = 0 WHERE queue_id = 'q1'")).toThrow(/CHECK/);
    expect(() => run("UPDATE queue SET status = 'PAUSED' WHERE queue_id = 'q1'")).toThrow(/CHECK/);
  });
  it("enforces foreign keys", () => {
    expect(() => run("INSERT INTO queue_entry (entry_id, queue_id, user_id, joined_at) VALUES ('z', 'nope', 'u3', 'now')")).toThrow(/FOREIGN KEY/);
    expect(() => run("INSERT INTO queue_entry (entry_id, queue_id, user_id, joined_at) VALUES ('z', 'q1', 'nobody', 'now')")).toThrow(/FOREIGN KEY/);
    expect(() => run("INSERT INTO notification (notification_id, user_id, type, message, created_at) VALUES ('z', 'nobody', 'QUEUE_UPDATE', 'hi', 'now')")).toThrow(/FOREIGN KEY/);
  });
  it("allows one active entry per person per queue and one person being served", () => {
    expect(() => run("INSERT INTO queue_entry (entry_id, queue_id, user_id, joined_at) VALUES ('z', 'q1', 'u3', 'now')")).toThrow(/UNIQUE/);
    expect(() => run("INSERT INTO queue_entry (entry_id, queue_id, user_id, joined_at, status) VALUES ('z', 'q4', 'u3', 'now', 'SERVING')")).toThrow(/UNIQUE/);
  });
  it("ties ended_at to the finished statuses", () => {
    expect(() => run("UPDATE queue_entry SET ended_at = 'now' WHERE entry_id = 'e1'")).toThrow(/CHECK/);
    expect(() => run("UPDATE queue_entry SET status = 'COMPLETED' WHERE entry_id = 'e1'")).toThrow(/CHECK/);
  });
  it("keeps permission rules (create roles needs assign roles)", () => {
    expect(() => run("UPDATE admin_permission SET can_assign_roles = 0 WHERE permission_id = 'p3'")).toThrow(/CHECK/);
  });
  it("limits notification messages and statuses", () => {
    expect(() => run("UPDATE notification SET message = '' WHERE notification_id = 'n1'")).toThrow(/CHECK/);
    expect(() => run("UPDATE notification SET status = 'READ' WHERE notification_id = 'n1'")).toThrow(/CHECK/);
  });
});

describe("positions", () => {
  const positions = (queueId: string) =>
    (getDb().prepare("SELECT user_id, position FROM queue_entry WHERE queue_id = ? AND position IS NOT NULL ORDER BY position").all(queueId) as any[]).map(
      (r) => [r.user_id, r.position]
    );
  it("is filled in for the seed data, in priority order", () => {
    expect(positions("q1")).toEqual([["u4", 1], ["u3", 2], ["u5", 3], ["u8", 4], ["u9", 5]]);
    expect(positions("q4")).toEqual([["u4", 1], ["u10", 2]]);
  });
  it("updates when someone joins or leaves", () => {
    repo.insertEntry({ entryId: "n1", userId: "u2", queueId: "q1", joinedAt: "2026-11-06T12:00:00Z", endedAt: null, status: "WAITING", roleIds: ["r3"] });
    expect(positions("q1")[0]).toEqual(["u2", 1]); // Has Appointment outranks everyone
    expect(repo.getEntryPosition("n1")).toBe(1);
    repo.setEntryStatus("n1", "CANCELLED", "2026-11-06T12:05:00Z");
    expect(positions("q1")[0]).toEqual(["u4", 1]);
    expect(repo.getEntryPosition("n1")).toBeNull();
    expect(repo.getEntryPosition("missing")).toBeNull();
  });
});

describe("repository", () => {
  it("finds, lists and counts", () => {
    expect(repo.findUserById("u3")?.name).toBe("Sam Student");
    expect(repo.findUserById("nope")).toBeNull();
    expect(repo.findUserByEmail("nobody@x.co")).toBeNull();
    expect(repo.findEntry("nope")).toBeNull();
    expect(repo.setEntryStatus("nope", "CANCELLED")).toBeNull();
    expect(repo.findOrganization("o1")?.name).toBe("University Student Services");
    expect(repo.findOrganization("nope")).toBeNull();
    expect(repo.listOwnedOrgIds("u1")).toEqual(["o1"]);
    expect(repo.listAdminQueueIds("u2").sort()).toEqual(["q1", "q2", "q4"]);
    expect(repo.hasAdminPermission("u2", "q1")).toBe(true);
    expect(repo.hasAdminPermission("u3", "q1")).toBe(false);
    expect(repo.listEntriesByQueue("q1").length).toBeGreaterThan(5);
    expect(repo.listEntriesByUser("u3", ["WAITING"]).length).toBe(2);
    expect(repo.countEntries("q1", ["WAITING"])).toBe(5);
    expect(repo.getRoleWeights("q1").get("r3")).toBe(8);
    expect(repo.listQueues().length).toBe(7);
    expect(repo.listQueues({ activeOnly: true }).length).toBe(6);
    expect(repo.findQueue("nope")).toBeNull();
  });
  it("maps queue status to isOpen and isActive and back", () => {
    const q = repo.updateQueue("q1", { isOpen: false })!;
    expect([q.isOpen, q.isActive]).toEqual([false, true]);
    const hidden = repo.updateQueue("q1", { isActive: false })!;
    expect([hidden.isOpen, hidden.isActive]).toEqual([false, false]);
    const open = repo.updateQueue("q1", { isActive: true, isOpen: true, name: "Renamed" })!;
    expect([open.isOpen, open.isActive, open.name]).toEqual([true, true, "Renamed"]);
    expect(repo.updateQueue("nope", { name: "x" })).toBeNull();
    expect(() => repo.updateQueue("q1", { maxCapacity: 0 })).toThrow(/CHECK/);
    expect(repo.findQueue("q1")?.name).toBe("Renamed"); // failed update changed nothing
  });
  it("rolls back a half-finished insert", () => {
    const base = repo.findQueue("q1")!;
    expect(() => repo.insertQueue({ ...base, queueId: "qx", serviceId: "sx", maxCapacity: 0 })).toThrow();
    expect(getDb().prepare("SELECT 1 FROM service WHERE service_id = 'sx'").get()).toBeUndefined();
  });
  it("advances a queue: completes the current person and serves the next", () => {
    const result = repo.advanceQueue("q4");
    expect(result.completed?.userId).toBe("u9");
    expect(result.completed?.status).toBe("COMPLETED");
    expect(result.serving?.userId).toBe("u4");
    expect(repo.getEntryPosition(result.serving!.entryId)).toBeNull();
    expect(repo.advanceQueue("q4").serving?.userId).toBe("u10");
    const empty = repo.advanceQueue("q4");
    expect(empty.serving).toBeNull();
    expect(empty.completed?.userId).toBe("u10");
    expect(repo.advanceQueue("q4")).toEqual({ completed: null, serving: null });
  });
  it("stores profile details and tolerates bad stored preferences", () => {
    expect(repo.getProfile("u3")).toMatchObject({ fullName: "Sam Student", email: "sam@example.com", phone: null, preferences: null });
    const updated = repo.updateProfile("u3", { phone: "713-555-0100", preferences: { emailAlerts: true } })!;
    expect(updated.preferences).toEqual({ emailAlerts: true });
    expect(repo.updateProfile("u3", { phone: null, preferences: null })!.phone).toBeNull();
    run("UPDATE user_profile SET preferences = 'not json' WHERE user_id = 'u3'");
    expect(repo.getProfile("u3")!.preferences).toBeNull();
    expect(repo.getProfile("nope")).toBeNull();
    expect(repo.updateProfile("nope", { fullName: "x" })).toBeNull();
  });
});

describe("GET and PATCH /api/me/profile", () => {
  it("requires login", async () => {
    expect((await profileGet(new Request("http://x/api"))).status).toBe(401);
  });
  it("shows and updates the profile", async () => {
    expect((await json(await profileGet(as("u3")))).data.fullName).toBe("Sam Student");
    const res = await profilePatch(as("u3", "PATCH", { fullName: "Sam S", phone: "555-1234", preferences: { theme: "dark" } }));
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ fullName: "Sam S", phone: "555-1234", preferences: { theme: "dark" } });
    expect((await json(await profileGet(as("u3")))).data.fullName).toBe("Sam S");
  });
  it("rejects bad values with field messages", async () => {
    const tooLong = await profilePatch(as("u3", "PATCH", { fullName: "x".repeat(101) }));
    expect(tooLong.status).toBe(400);
    expect((await json(tooLong)).error.fields.fullName).toBeTruthy();
    for (const preferences of ["text", [1], { big: "x".repeat(1100) }]) {
      const res = await profilePatch(as("u3", "PATCH", { preferences }));
      expect((await json(res)).error.fields.preferences).toBeTruthy();
    }
    expect((await profilePatch(as("u3", "PATCH", { preferences: null }))).status).toBe(200);
  });
});

describe("accounts and queues created through the routes land in the database", () => {
  it("userAuth stores a hashed password, never the plain one", async () => {
    const res = await userAuthPost(post({ username: "tester", email: "t@example.com", password: "secret123" }));
    expect(res.status).toBe(201);
    const stored = repo.findUserByEmail("t@example.com")!;
    expect(stored.passwordHash).not.toBe("secret123");
    expect(stored.passwordHash).toContain(":");
    expect(stored.role).toBe("USER");
    const ok = await userAuthGet(new Request("http://x/api?email=t@example.com&password=secret123"));
    expect((await json(ok)).userId).toBe(stored.userId);
    expect((await userAuthPost(post({ username: "t", email: "t@example.com", password: "secret123" }))).status).toBe(409);
    expect((await userAuthPost(post({ username: "", email: "z@example.com", password: "secret123" }))).status).toBe(400);
  });
  it("addQueue and editQueue reject values the database refuses", async () => {
    const base = { orgId: "o1", name: "N", description: "d", expectedDurationMinutes: 10, priorityLevel: "LOW", maxCapacity: 5 };
    expect((await addQueuePost(post({ ...base, expectedDurationMinutes: 0 }))).status).toBe(400);
    expect((await addQueuePost(post({ ...base, orgId: "nope" }))).status).toBe(400);
    expect((await addQueuePost(post({ ...base, priorityLevel: "URGENT" }))).status).toBe(400);
    const made = await json(await addQueuePost(post(base))); // no queueId sent, so one is generated
    expect(repo.findQueue(made.queueId)?.name).toBe("N");
    const bad = new Request("http://x/api", { method: "PATCH", body: JSON.stringify({ queueId: "q1", priorityLevel: "URGENT" }) });
    expect((await editQueuePatch(bad)).status).toBe(400);
    expect(repo.findQueue("q1")?.priorityLevel).toBe("MEDIUM");
  });
});
