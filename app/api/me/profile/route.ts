import { requireUser } from "@/app/lib/server/auth";
import { ApiError, handle, ok, readJson } from "@/app/lib/server/http";
import { LIMITS } from "@/app/lib/server/config";
import { getMyProfile, updateMyProfile, type ProfileChanges } from "@/app/lib/server/profileService";
import { parseBody } from "@/app/lib/server/validation";

export const GET = handle(async (request: Request) => {
  const user = requireUser(request);
  return ok(getMyProfile(user.userId));
});

// Body (every field is optional): { "fullName": "Sam S", "phone": "713-555-0100", "preferences": { "emailAlerts": true } }
export const PATCH = handle(async (request: Request) => {
  const user = requireUser(request);
  const raw = (await readJson(request)) as Record<string, unknown>;
  const body = parseBody<{ fullName?: string; phone?: string }>(raw, {
    fullName: { type: "string", required: false, minLength: 1, maxLength: LIMITS.nameMax },
    phone: { type: "string", required: false, maxLength: 30 },
  });
  const changes: ProfileChanges = { ...body };
  if (raw && raw.preferences !== undefined) {
    const p = raw.preferences;
    if (p !== null && (typeof p !== "object" || Array.isArray(p))) {
      throw new ApiError(400, "VALIDATION_ERROR", "Some fields are invalid.", {
        preferences: "Preferences must be an object.",
      });
    }
    if (JSON.stringify(p).length > 1000) {
      throw new ApiError(400, "VALIDATION_ERROR", "Some fields are invalid.", {
        preferences: "Preferences must be at most 1000 characters.",
      });
    }
    changes.preferences = p as Record<string, unknown> | null;
  }
  return ok(updateMyProfile(user.userId, changes));
});
