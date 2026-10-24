/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { SESSION_COOKIE } from "./config";
import { ApiError, created, fail, handle, ok, readJson } from "./http";
import { hashPassword, verifyPassword } from "./password";
import { getQueueRole, getAdminQueueIds, getOwnedOrgIds, requireOrgOwner, requireQueueAdmin } from "./access";
import {
  clearSessionCookie, createSession, destroySession, getCurrentUser, getSessionToken,
  parseCookies, requireUser, sessionCookie, toPublicUser,
} from "./auth";
import {
  countActiveEntries, entryWeight, estimateWaitMinutes, getPosition, getWaitingOrder, isAlmostReady,
} from "./queueLogic";
import { generateId, getStore, resetStore } from "./store";
import { parseBody, validate } from "./validation";

const req = (headers: Record<string, string> = {}) => new Request("http://x/api", { headers });
const body = async (r: Response) => (await r.json()) as any;

beforeEach(() => resetStore());

describe("http", () => {
  it("wraps success and created", async () => {
    expect(await body(ok({ a: 1 }))).toEqual({ data: { a: 1 } });
    expect(created({}).status).toBe(201);
  });
  it("builds errors with optional fields", async () => {
    expect((await body(fail(400, "X", "m"))).error).toEqual({ code: "X", message: "m" });
    expect((await body(fail(400, "X", "m", { a: "b" }))).error.fields).toEqual({ a: "b" });
  });
  it("handle maps ApiError and unknown errors", async () => {
    const e = await handle(() => { throw new ApiError(404, "NOT_FOUND", "no"); })();
    expect(e.status).toBe(404);
    const spy = console.error; console.error = () => {};
    const u = await handle(() => { throw new Error("boom"); })();
    console.error = spy;
    expect(u.status).toBe(500);
    expect((await body(u)).error.code).toBe("INTERNAL_ERROR");
  });
  it("readJson rejects bad JSON", async () => {
    await expect(readJson(new Request("http://x", { method: "POST", body: "{" }))).rejects.toMatchObject({ code: "INVALID_JSON" });
    expect(await readJson(new Request("http://x", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
  });
  it("health route works", async () => {
    expect(await body(await healthGet())).toEqual({ data: { status: "ok" } });
  });
});

describe("validation", () => {
  const rules = {
    name: { type: "string", maxLength: 5 },
    email: { type: "string", email: true, required: false },
    n: { type: "number", integer: true, min: 1, max: 9 },
    b: { type: "boolean", required: false },
    p: { type: "enum", values: ["LOW", "HIGH"] },
  } as const;
  it("accepts good input and trims", () => {
    const r = validate({ name: " ab ", n: 3, p: "LOW", email: "a@b.co", b: true }, rules);
    expect(r).toEqual({ ok: true, value: { name: "ab", n: 3, p: "LOW", email: "a@b.co", b: true } });
  });
  it("reports each bad field", () => {
    const r = validate({ name: "toolong", n: 1.5, p: "NO", email: "bad", b: "x" }, rules);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(["b", "email", "n", "name", "p"]);
  });
  it("checks min, max, type, and required", () => {
    const r = validate({ name: 5, n: 0 }, rules);
    if (!r.ok) { expect(r.fields.name).toMatch(/text/); expect(r.fields.n).toMatch(/at least/); expect(r.fields.p).toMatch(/required/); }
    const r2 = validate({ name: "a", n: 10, p: "LOW" }, rules);
    if (!r2.ok) expect(r2.fields.n).toMatch(/at most/);
    const r3 = validate({ name: "a", n: "x", p: "LOW" }, rules);
    if (!r3.ok) expect(r3.fields.n).toMatch(/number/);
    const r4 = validate({ name: "", n: 1, p: "LOW" }, { name: { type: "string", minLength: 2, required: false } });
    expect(r4.ok).toBe(true);
    const r5 = validate({ name: "a" }, { name: { type: "string", minLength: 2 } });
    expect(r5.ok).toBe(false);
  });
  it("rejects non-objects", () => {
    expect(validate([], rules).ok).toBe(false);
    expect(validate(null, rules).ok).toBe(false);
  });
  it("parseBody throws a 400 ApiError", () => {
    expect(() => parseBody({}, rules)).toThrowError(ApiError);
    expect(parseBody({ name: "a", n: 1, p: "LOW" }, rules)).toMatchObject({ name: "a" });
  });
});

describe("password", () => {
  it("hashes and verifies", () => {
    const h = hashPassword("secret123");
    expect(verifyPassword("secret123", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("x", null)).toBe(false);
    expect(verifyPassword("x", "nocolon")).toBe(false);
    expect(verifyPassword("x", "aa:")).toBe(false);
  });
});

describe("store", () => {
  it("seeds data, hashes demo passwords, and resets", () => {
    const s = getStore();
    expect(s.users.length).toBe(10);
    const sam = s.users.find((u) => u.email === "sam@example.com")!;
    expect(verifyPassword("password123", sam.passwordHash)).toBe(true);
    s.users.pop();
    expect(resetStore().users.length).toBe(10);
    expect(generateId()).not.toBe(generateId());
  });
  it("keeps seed users with null passwordHash as null", () => {
    expect(getStore().users.some((u) => u.passwordHash === null)).toBe(true);
  });
});

describe("auth", () => {
  it("parses cookies", () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies("a=1; b=2; junk; =x")).toEqual({ a: "1", b: "2" });
  });
  it("reads token from cookie or bearer header", () => {
    expect(getSessionToken(req())).toBeNull();
    expect(getSessionToken(req({ cookie: `${SESSION_COOKIE}=abc` }))).toBe("abc");
    expect(getSessionToken(req({ authorization: "Bearer tok" }))).toBe("tok");
    expect(getSessionToken(req({ authorization: "Bearer " }))).toBeNull();
    expect(getSessionToken(req({ authorization: "Basic x" }))).toBeNull();
  });
  it("creates, resolves, and destroys sessions", () => {
    const t = createSession("u3");
    const r = req({ authorization: `Bearer ${t}` });
    expect(getCurrentUser(r)?.userId).toBe("u3");
    expect(requireUser(r).userId).toBe("u3");
    destroySession(t);
    expect(getCurrentUser(r)).toBeNull();
    expect(() => requireUser(r)).toThrowError(/log in/);
    expect(getCurrentUser(req())).toBeNull();
    getStore().sessions.set("ghost", "nobody");
    expect(getCurrentUser(req({ authorization: "Bearer ghost" }))).toBeNull();
  });
  it("never leaks passwordHash", () => {
    const pub = toPublicUser(getStore().users[0]);
    expect("passwordHash" in pub).toBe(false);
  });
  it("builds cookies", () => {
    expect(sessionCookie("t")).toContain("HttpOnly");
    expect(clearSessionCookie()).toContain("Max-Age=0");
    const prev = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    expect(sessionCookie("t")).toContain("Secure");
    (process.env as any).NODE_ENV = prev;
  });
});

describe("access", () => {
  it("derives roles", () => {
    expect(getQueueRole("u1", "q1")).toBe("OWNER");
    expect(getQueueRole("u2", "q1")).toBe("ADMIN");
    expect(getQueueRole("u3", "q1")).toBe("USER");
    expect(getQueueRole("u1", "nope")).toBe("USER");
    expect(getOwnedOrgIds("u1").length).toBeGreaterThan(0);
    expect(getAdminQueueIds("u2").length).toBeGreaterThan(0);
  });
  it("requireQueueAdmin enforces login, existence, and role", () => {
    const as = (id: string) => req({ authorization: `Bearer ${createSession(id)}` });
    expect(() => requireQueueAdmin(req(), "q1")).toThrowError(/log in/);
    expect(() => requireQueueAdmin(as("u2"), "nope")).toThrowError(/not found/);
    expect(() => requireQueueAdmin(as("u3"), "q1")).toThrowError(/permission/);
    expect(requireQueueAdmin(as("u2"), "q1").role).toBe("ADMIN");
    expect(requireQueueAdmin(as("u1"), "q1").role).toBe("OWNER");
  });
  it("requireOrgOwner enforces ownership", () => {
    const as = (id: string) => req({ authorization: `Bearer ${createSession(id)}` });
    expect(() => requireOrgOwner(as("u1"), "nope")).toThrowError(/not found/);
    expect(() => requireOrgOwner(as("u2"), "o1")).toThrowError(/owner/);
    expect(requireOrgOwner(as("u1"), "o1").organization.orgId).toBe("o1");
  });
});

describe("queueLogic", () => {
  const entryFor = (userId: string, queueId: string) =>
    getStore().queueEntries.find((e) => e.userId === userId && e.queueId === queueId)!;
  it("orders by priority weight then join time", () => {
    const order = getWaitingOrder("q1").map((e) => e.userId);
    expect(order).toEqual(["u4", "u3", "u5", "u8", "u9"]);
    expect(getWaitingOrder("q5").map((e) => e.userId)).toEqual(["u8", "u9"]);
  });
  it("computes position, almost ready, and weight", () => {
    const first = entryFor("u4", "q1");
    expect(getPosition(first)).toBe(1);
    expect(isAlmostReady(first)).toBe(true);
    expect(isAlmostReady(entryFor("u9", "q1"))).toBe(false);
    expect(entryWeight(first)).toBeGreaterThan(0);
    const serving = getStore().queueEntries.find((e) => e.status === "SERVING")!;
    expect(getPosition(serving)).toBeNull();
    expect(isAlmostReady(serving)).toBe(false);
  });
  it("estimates wait and counts active entries", () => {
    const q4 = getStore().queues.find((q) => q.queueId === "q4")!;
    const e = entryFor("u4", "q4");
    expect(estimateWaitMinutes(e, q4)).toBe(q4.expectedDurationMinutes);
    const q1 = getStore().queues.find((q) => q.queueId === "q1")!;
    expect(estimateWaitMinutes(entryFor("u3", "q1"), q1)).not.toBeNull();
    expect(estimateWaitMinutes(getStore().queueEntries.find((x) => x.status === "SERVING")!, q4)).toBeNull();
    expect(countActiveEntries("q1")).toBeGreaterThan(0);
  });
  it("ignores unknown roles in weight", () => {
    const e = { ...entryFor("u3", "q1"), roleIds: ["nope"] };
    expect(entryWeight(e)).toBe(0);
  });
});
