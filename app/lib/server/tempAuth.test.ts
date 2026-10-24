import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { GET as entriesGet } from "@/app/api/me/entries/route";
import { resetStore } from "./store";
import { loginWithPassword } from "./tempAuthService";

const post = (body: unknown, raw = false) =>
  new Request("http://x/api", { method: "POST", body: raw ? (body as string) : JSON.stringify(body) });

beforeEach(() => resetStore());

describe("temporary login", () => {
  it("logs in, sets a cookie, and the cookie works on other endpoints", async () => {
    const res = await loginPost(post({ email: "Sam@Example.com", password: "password123" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("sq_session=");
    const body = await res.json();
    expect(body.data.email).toBe("sam@example.com");
    expect("passwordHash" in body.data).toBe(false);

    const withCookie = new Request("http://x/api", { headers: { cookie: cookie.split(";")[0] } });
    expect((await (await meGet(withCookie)).json()).data.userId).toBe("u3");
    expect((await (await entriesGet(withCookie)).json()).data.length).toBe(2);
  });
  it("rejects a wrong password, unknown email, and a passwordless account the same way", async () => {
    for (const creds of [
      { email: "sam@example.com", password: "wrongpass1" },
      { email: "nobody@example.com", password: "password123" },
    ]) {
      const res = await loginPost(post(creds));
      expect(res.status).toBe(401);
      expect((await res.json()).error.message).toBe("Incorrect email or password.");
    }
    expect(() => loginWithPassword("x@y.co", "p")).toThrowError(/Incorrect/);
  });
  it("validates the body", async () => {
    const res = await loginPost(post({ email: "bad", password: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields.email).toBeTruthy();
  });
  it("logout clears the session", async () => {
    const login = await loginPost(post({ email: "sam@example.com", password: "password123" }));
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const req = () => new Request("http://x/api", { method: "POST", headers: { cookie } });
    const out = await logoutPost(req());
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await meGet(new Request("http://x/api", { headers: { cookie } }))).status).toBe(401);
    expect((await logoutPost(new Request("http://x/api", { method: "POST" }))).status).toBe(200);
  });
});
