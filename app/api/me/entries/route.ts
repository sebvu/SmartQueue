import { requireUser } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";
import { getMyCurrentEntries } from "@/app/lib/server/myEntriesService";

export const GET = handle((request: Request) => {
  const user = requireUser(request);
  return ok(getMyCurrentEntries(user.userId));
});
