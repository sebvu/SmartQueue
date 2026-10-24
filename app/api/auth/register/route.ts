import { sessionCookie } from "@/app/lib/server/auth";
import { LIMITS } from "@/app/lib/server/config";
import { created, handle, readJson } from "@/app/lib/server/http";
import { registerUser } from "@/app/lib/server/registerService";
import { parseBody } from "@/app/lib/server/validation";

// Body: { "username": "...", "email": "...", "password": "..." }
// On success the person is signed in (the session cookie is set) and the new user is returned.
export const POST = handle(async (request: Request) => {
  const body = parseBody<{ username: string; email: string; password: string }>(
    await readJson(request),
    {
      username: { type: "string", minLength: 3, maxLength: LIMITS.nameMax },
      email: { type: "string", email: true, maxLength: LIMITS.emailMax },
      password: { type: "string", minLength: LIMITS.passwordMin, maxLength: LIMITS.passwordMax },
    }
  );
  const { token, user } = registerUser(body.username, body.email, body.password);
  return created(user, { headers: { "Set-Cookie": sessionCookie(token) } });
});
