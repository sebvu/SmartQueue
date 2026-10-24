import { requireUser } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";
import { markAllNotificationsRead } from "@/app/lib/server/notificationService";

export const POST = handle((request: Request) => {
  const user = requireUser(request);
  return ok(markAllNotificationsRead(user.userId));
});
