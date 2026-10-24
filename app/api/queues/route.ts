import { requireUser } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";
import { listQueues } from "@/app/lib/server/queueUserService";

// All active queues with length and wait estimate.
export const GET = handle((request: Request) => {
  requireUser(request);
  return ok(listQueues());
});
