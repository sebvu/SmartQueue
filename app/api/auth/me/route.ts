import { requireUser, toPublicUser } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";

export const GET = handle((request: Request) => ok(toPublicUser(requireUser(request))));
