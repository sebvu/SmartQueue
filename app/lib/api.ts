// Small helpers for calling our own API from the browser.
// Every endpoint answers { data } on success or { error } on failure (see docs/API.md).

// Returns the "data" part, or null if the request failed (for example, not logged in).
// Screens use null to fall back to their sample data so they never break.
export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { credentials: "same-origin" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

// Sends a change (PATCH or POST). Returns true when the server accepted it.
export async function apiSend(
  path: string,
  method: "PATCH" | "POST",
  body?: unknown
): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type ApiResult<T> = {
  ok: boolean;
  status: number; // 0 means the request never reached the server
  data: T | null;
  message: string | null; // the server's error message, if there was one
};

// Like apiSend, but tells the screen what happened so it can show a message
// (for example "This queue is full." or "Please log in to continue.").
export async function apiRequest<T>(
  path: string,
  method: "GET" | "PATCH" | "POST",
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: T;
      error?: { message?: string };
    };
    return {
      ok: res.ok,
      status: res.status,
      data: json.data ?? null,
      message: json.error?.message ?? null,
    };
  } catch {
    return { ok: false, status: 0, data: null, message: "Could not reach the server." };
  }
}
