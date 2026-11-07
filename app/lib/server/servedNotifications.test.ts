import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as serveUserPatch } from "@/app/api/serveUser/route";
import { listNotifications } from "./notificationService";
import * as repo from "./repo";
import { resetStore } from "./store";

const req = (body: unknown) =>
  new Request("http://x/api/serveUser", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => resetStore());

describe("served user notifications", () => {
  it("notifies the person being served", async () => {
    const res = await serveUserPatch(req({ queueId: "q1" }));

    expect(res.status).toBe(200);

    const served = await res.json();

    const notification = listNotifications(served.userId).find(
      (n) => n.entryId === served.entryId && n.message === "It's your turn!"
    );

    expect(notification).toBeDefined();
  });

  it("notifies the person now at position 2", async () => {
    const res = await serveUserPatch(req({ queueId: "q1" }));

    expect(res.status).toBe(200);

    const secondWaiting = repo.listWaitingOrdered("q1")[1];

    expect(secondWaiting).toBeDefined();

    const notification = listNotifications(secondWaiting.userId).find(
      (n) =>
        n.entryId === secondWaiting.entryId &&
        n.message === "You're almost up!"
    );

    expect(notification).toBeDefined();
  });
});