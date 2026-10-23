import { ApiError } from "./http";

// Declare the rules for a request body, then call parseBody(). On bad input it throws
// a 400 VALIDATION_ERROR whose "fields" says what is wrong with each field.
//
//   const body = parseBody(await readJson(request), {
//     name: { type: "string", maxLength: LIMITS.nameMax },
//     expectedDurationMinutes: { type: "number", integer: true, min: 1 },
//     priorityLevel: { type: "enum", values: ["LOW", "MEDIUM", "HIGH"] },
//     isOpen: { type: "boolean", required: false },
//   });

export type FieldRule =
  | { type: "string"; required?: boolean; minLength?: number; maxLength?: number; email?: boolean; label?: string }
  | { type: "number"; required?: boolean; min?: number; max?: number; integer?: boolean; label?: string }
  | { type: "boolean"; required?: boolean; label?: string }
  | { type: "enum"; values: readonly string[]; required?: boolean; label?: string };

export type Rules = Record<string, FieldRule>;

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; fields: Record<string, string> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function humanize(name: string): string {
  const spaced = name.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isMissing(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
}

// Returns an error message, or null when the value is fine.
function checkRule(label: string, raw: unknown, rule: FieldRule): string | null {
  switch (rule.type) {
    case "string": {
      if (typeof raw !== "string") return `${label} must be text.`;
      const text = raw.trim();
      if (rule.minLength !== undefined && text.length < rule.minLength) {
        return `${label} must be at least ${rule.minLength} characters.`;
      }
      if (rule.maxLength !== undefined && text.length > rule.maxLength) {
        return `${label} must be at most ${rule.maxLength} characters.`;
      }
      if (rule.email && !EMAIL_PATTERN.test(text)) return `${label} must be a valid email address.`;
      return null;
    }
    case "number": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return `${label} must be a number.`;
      if (rule.integer && !Number.isInteger(raw)) return `${label} must be a whole number.`;
      if (rule.min !== undefined && raw < rule.min) return `${label} must be at least ${rule.min}.`;
      if (rule.max !== undefined && raw > rule.max) return `${label} must be at most ${rule.max}.`;
      return null;
    }
    case "boolean":
      return typeof raw === "boolean" ? null : `${label} must be true or false.`;
    case "enum":
      return typeof raw === "string" && rule.values.includes(raw)
        ? null
        : `${label} must be one of: ${rule.values.join(", ")}.`;
  }
}

export function validate(input: unknown, rules: Rules): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, fields: { body: "Request body must be a JSON object." } };
  }
  const source = input as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const value: Record<string, unknown> = {};

  for (const [name, rule] of Object.entries(rules)) {
    const label = rule.label ?? humanize(name);
    const raw = source[name];

    if (isMissing(raw)) {
      if (rule.required !== false) fields[name] = `${label} is required.`;
      continue;
    }
    const error = checkRule(label, raw, rule);
    if (error) {
      fields[name] = error;
    } else {
      value[name] = typeof raw === "string" ? raw.trim() : raw;
    }
  }

  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, value };
}

export function parseBody<T = Record<string, unknown>>(input: unknown, rules: Rules): T {
  const result = validate(input, rules);
  if (!result.ok) {
    throw new ApiError(400, "VALIDATION_ERROR", "Some fields are invalid.", result.fields);
  }
  return result.value as T;
}
