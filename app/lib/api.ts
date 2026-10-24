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
