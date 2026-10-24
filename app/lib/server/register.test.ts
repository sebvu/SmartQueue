/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { getStore, resetStore } from "./store";
import { registerUser } from "./registerService";
import { verifyPassword } from "./password";

const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const good = { username: "newperson", email: "New.Person@Example.com", password: "supersecret1" };

beforeEach(() => resetStore());

describe("registerUser", () => {
  it("creates a user with a hashed password and lower-case email", () => {
    const { user, token } = registerUser("  Newbie ", "New@Example.com", "supersecret1");
    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("Newbie");
    expect("passwordHash" in user).toBe(false);
    expect(token).toBeTruthy();
    const stored = getStore().users.find((u) => u.userId === user.userId)!;
    expect(stored.passwordHash).not.toBe("supersecret1");
    expect(verifyPassword("supersecret1", stored.passwordHash)).toBe(true);
  });
  it("refuses an email that already exists, ignoring case", () => {
    expect(() => registerUser("x", "SAM@example.com", "supersecret1")).toThrowError(/already exists/);
  });
});

describe("POST /api/auth/register", () => {
  it("registers, signs in, and the new account can log in again", async () => {
    const res = await registerPost(post(good));
    expect(res.status).toBe(201);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("sq_session=");
    const body = (await res.json()) as any;
    expect(body.data.email).toBe("new.person@example.com");
    const me = await meGet(new Request("http://x/api", { headers: { cookie: cookie.split(";")[0] } }));
    expect(((await me.json()) as any).data.name).toBe("newperson");
    const login = await loginPost(post({ email: "new.person@example.com", password: "supersecret1" }));
    expect(login.status).toBe(200);
  });
  it("returns 409 for a duplicate email", async () => {
    await registerPost(post(good));
    const again = await registerPost(post(good));
    expect(again.status).toBe(409);
    const body = (await again.json()) as any;
    expect(body.error.code).toBe("EMAIL_TAKEN");
    expect(body.error.fields.email).toBeTruthy();
  });
  it("validates every field", async () => {
    const res = await registerPost(post({ username: "ab", email: "nope", password: "short" }));
    expect(res.status).toBe(400);
    const fields = ((await res.json()) as any).error.fields;
    expect(Object.keys(fields).sort()).toEqual(["email", "password", "username"]);
    const empty = await registerPost(post({}));
    expect(empty.status).toBe(400);
    const badJson = await registerPost(new Request("http://x/api", { method: "POST", body: "{" }));
    expect(((await badJson.json()) as any).error.code).toBe("INVALID_JSON");
  });
});
