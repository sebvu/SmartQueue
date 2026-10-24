import { requireUser } from "@/app/lib/server/auth";
import { handle, ok, readJson } from "@/app/lib/server/http";
import { setNotificationRead } from "@/app/lib/server/notificationService";
import { parseBody } from "@/app/lib/server/validation";

type Context = { params: Promise<{ id: string }> };

// Body: { "isRead": true }
export const PATCH = handle(async (request: Request, ctx: Context) => {
  const user = requireUser(request);
  const { id } = await ctx.params;
  const body = parseBody<{ isRead: boolean }>(await readJson(request), {
    isRead: { type: "boolean" },
  });
  return ok(setNotificationRead(user.userId, id, body.isRead));
});
