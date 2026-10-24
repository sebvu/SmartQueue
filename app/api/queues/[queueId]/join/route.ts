import { requireUser } from "@/app/lib/server/auth";
import { created, handle } from "@/app/lib/server/http";
import { joinQueue } from "@/app/lib/server/queueUserService";

type Context = { params: Promise<{ queueId: string }> };

export const POST = handle(async (request: Request, ctx: Context) => {
  const user = requireUser(request);
  const { queueId } = await ctx.params;
  return created(joinQueue(user.userId, queueId));
});
