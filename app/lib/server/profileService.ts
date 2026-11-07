import { ApiError } from "./http";
import * as repo from "./repo";
import type { UserProfile } from "./repo";

// The signed-in user's profile (user_profile table): full name, phone, and preferences.

export type ProfileChanges = {
  fullName?: string;
  phone?: string | null;
  preferences?: Record<string, unknown> | null;
};

export function getMyProfile(userId: string): UserProfile {
  const profile = repo.getProfile(userId);
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Profile not found.");
  return profile;
}

export function updateMyProfile(userId: string, changes: ProfileChanges): UserProfile {
  const updated = repo.updateProfile(userId, changes);
  if (!updated) throw new ApiError(404, "NOT_FOUND", "Profile not found.");
  return updated;
}
