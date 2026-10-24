import { requireUser } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";
import { getQueueDetail } from "@/app/lib/server/queueUserService";

type Context = { params: Promise<{ queueId: string }> };

// One queue, plus the caller's own entry in it (myEntry is null if they are not in it).
export const GET = handle(async (request: Request, ctx: Context) => {
  const user = requireUser(request);
  const { queueId } = await ctx.params;
  return ok(getQueueDetail(user.userId, queueId));
});
