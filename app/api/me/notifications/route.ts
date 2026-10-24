import { requireUser } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";
import { listNotifications } from "@/app/lib/server/notificationService";

export const GET = handle((request: Request) => {
  const user = requireUser(request);
  return ok(listNotifications(user.userId));
});
