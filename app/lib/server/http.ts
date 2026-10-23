// One response format for every endpoint.
//   Success: { "data": ... }
//   Error:   { "error": { "code": "...", "message": "...", "fields"?: { name: "..." } } }

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type ResponseOptions = { status?: number; headers?: HeadersInit };

export function ok<T>(data: T, options: ResponseOptions = {}): Response {
  return Response.json({ data }, { status: options.status ?? 200, headers: options.headers });
}

export function created<T>(data: T, options: Omit<ResponseOptions, "status"> = {}): Response {
  return ok(data, { ...options, status: 201 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): Response {
  const error: { code: string; message: string; fields?: Record<string, string> } = {
    code,
    message,
  };
  if (fields) error.fields = fields;
  return Response.json({ error }, { status });
}

// Wrap every route handler with handle(). Throw an ApiError anywhere inside it and the
// caller gets the standard error response. Any other error becomes a 500.
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<Response> | Response
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.status, err.code, err.message, err.fields);
      }
      console.error("Unhandled API error:", err);
      return fail(500, "INTERNAL_ERROR", "Something went wrong on the server.");
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}
