import { clearSessionCookie, destroySession, getSessionToken } from "@/app/lib/server/auth";
import { handle, ok } from "@/app/lib/server/http";

export const POST = handle((request: Request) => {
  const token = getSessionToken(request);
  if (token) destroySession(token);
  return ok({ loggedOut: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
});
