export class AuthApiError extends Error {
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AuthApiError";
    this.fields = fields;
  }
}

type ApiPayload = {
  data?: unknown;
  error?: { code?: string; message?: string; fields?: Record<string, string> };
} | null;

// POSTs JSON to a same-origin endpoint. The server sets the session cookie
// itself, so there is nothing to store on the client.
export async function postJson(url: string, body: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new AuthApiError("Could not reach the server. Please try again.");
  }

  let payload: ApiPayload = null;
  try {
    payload = (await res.json()) as ApiPayload;
  } catch {
    // non-JSON response; handled below
  }

  if (!res.ok) {
    throw new AuthApiError(
      payload?.error?.message ?? "Something went wrong. Please try again.",
      payload?.error?.fields,
    );
  }
  return payload?.data;
}

// Splits the server's per-field errors into the ones this form has a spot for,
// and says whether anything is left over that needs the general message.
export function mapFieldErrors<F extends string>(
  fields: Record<string, string> | undefined,
  allowed: readonly F[],
): { fieldErrors: Partial<Record<F, string>>; hasUnmapped: boolean } {
  const fieldErrors: Partial<Record<F, string>> = {};
  const entries = Object.entries(fields ?? {});
  let hasUnmapped = entries.length === 0;

  for (const [key, message] of entries) {
    if ((allowed as readonly string[]).includes(key)) {
      fieldErrors[key as F] = message;
    } else {
      hasUnmapped = true;
    }
  }
  return { fieldErrors, hasUnmapped };
}
