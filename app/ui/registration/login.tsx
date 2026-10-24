import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./registration.module.css";
import { PASSWORD_MAX, validateEmail } from "./authValidation";
import { AuthApiError, mapFieldErrors, postJson } from "./authApi";

interface LoginProps {
  onToggleMode: () => void;
}

type Field = "email" | "password";
const FIELDS = ["email", "password"] as const;

export default function Login({ onToggleMode }: LoginProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    email: false,
    password: false,
  });
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<Field, string>>
  >({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const errors: Record<Field, string> = {
    email: validateEmail(email),
    password: password.length === 0 ? "Please enter a password." : "",
  };

  // Server-reported errors win; they clear as soon as the field is edited.
  const fieldError = (field: Field) =>
    serverFieldErrors[field] || (touched[field] ? errors[field] : "");

  const inputClass = (field: Field) => {
    if (fieldError(field)) return `${styles.input} ${styles.inputError}`;
    return touched[field]
      ? `${styles.input} ${styles.inputValid}`
      : styles.input;
  };

  const markEdited = (field: Field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setServerFieldErrors((s) => ({ ...s, [field]: undefined }));
    setServerError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setServerError("");
    setServerFieldErrors({});

    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      // The server sets the session cookie on success.
      await postJson("/api/auth/login", { email: email.trim(), password });
      router.push("/home");
    } catch (err) {
      if (err instanceof AuthApiError) {
        const { fieldErrors, hasUnmapped } = mapFieldErrors(err.fields, FIELDS);
        setServerFieldErrors(fieldErrors);
        if (hasUnmapped) setServerError(err.message);
      } else {
        setServerError("Login failed. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <h1 className={styles.title}>Welcome Back</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.formGroup}>
          <label
            className={`${styles.label} ${styles.required}`}
            htmlFor="email"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            className={inputClass("email")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              markEdited("email");
            }}
            placeholder="you@example.com"
            required
          />
          {fieldError("email") && (
            <span className={styles.errorText} aria-live="polite">
              {fieldError("email")}
            </span>
          )}
        </div>

        <div className={styles.formGroup}>
          <label
            className={`${styles.label} ${styles.required}`}
            htmlFor="password"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            className={inputClass("password")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              markEdited("password");
            }}
            placeholder="••••••••"
            maxLength={PASSWORD_MAX}
            required
          />
          {fieldError("password") && (
            <span className={styles.errorText} aria-live="polite">
              {fieldError("password")}
            </span>
          )}
        </div>

        {serverError && (
          <span className={styles.errorText} aria-live="polite">
            {serverError}
          </span>
        )}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className={styles.toggleText}>
        Don't have an account?
        <button
          type="button"
          onClick={onToggleMode}
          className={styles.toggleLink}
        >
          Sign up
        </button>
      </p>
    </div>
  );
}
