import { sessionCookie } from "@/app/lib/server/auth";
import { handle, ok, readJson } from "@/app/lib/server/http";
import { loginWithPassword } from "@/app/lib/server/tempAuthService";
import { parseBody } from "@/app/lib/server/validation";
import { LIMITS } from "@/app/lib/server/config";

// Body: { "email": "...", "password": "..." }
export const POST = handle(async (request: Request) => {
  const body = parseBody<{ email: string; password: string }>(await readJson(request), {
    email: { type: "string", email: true, maxLength: LIMITS.emailMax },
    password: { type: "string", maxLength: LIMITS.passwordMax },
  });
  const { token, user } = loginWithPassword(body.email, body.password);
  return ok(user, { headers: { "Set-Cookie": sessionCookie(token) } });
});
