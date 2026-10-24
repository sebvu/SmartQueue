import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./registration.module.css";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./authValidation";
import { AuthApiError, mapFieldErrors, postJson } from "./authApi";

interface RegisterProps {
  onToggleMode: () => void;
}

type Field = "username" | "email" | "password" | "confirm";
type ServerField = Exclude<Field, "confirm">;
const SERVER_FIELDS = ["username", "email", "password"] as const;

export default function Register({ onToggleMode }: RegisterProps) {
  const router = useRouter();

  const [values, setValues] = useState<Record<Field, string>>({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    username: false,
    email: false,
    password: false,
    confirm: false,
  });
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Partial<Record<ServerField, string>>
  >({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirm field stays disabled until the password itself is valid.
  const passwordError = validatePassword(values.password);
  const confirmDisabled = passwordError.length > 0;

  // Errors are derived from the current values, so changing the password
  // automatically re-checks the confirmation too.
  const errors: Record<Field, string> = {
    username: validateUsername(values.username),
    email: validateEmail(values.email),
    password: passwordError,
    confirm: confirmDisabled
      ? ""
      : validateConfirmPassword(values.confirm, values.password),
  };

  // Server-reported errors win; they clear as soon as the field is edited.
  const fieldError = (field: Field): string => {
    if (field === "confirm") {
      return touched.confirm && !confirmDisabled ? errors.confirm : "";
    }
    return serverFieldErrors[field] || (touched[field] ? errors[field] : "");
  };

  const inputClass = (field: Field) => {
    if (fieldError(field)) return `${styles.input} ${styles.inputError}`;
    const showValid =
      field === "confirm"
        ? touched.confirm && !confirmDisabled
        : touched[field];
    return showValid ? `${styles.input} ${styles.inputValid}` : styles.input;
  };

  const handleChange =
    (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setTouched((t) => ({ ...t, [field]: true }));
      if (field !== "confirm") {
        setServerFieldErrors((s) => ({ ...s, [field]: undefined }));
      }
      setServerError("");
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, confirm: true });
    setServerError("");
    setServerFieldErrors({});

    // Confirm is disabled while the password is invalid, so it must be
    // filled in (and matching) before we accept the form.
    const confirmError = validateConfirmPassword(
      values.confirm,
      values.password,
    );
    if (errors.username || errors.email || errors.password || confirmError) {
      return;
    }

    setSubmitting(true);
    try {
      // On success the server also signs the person in (session cookie).
      await postJson("/api/auth/register", {
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      router.push("/home");
    } catch (err) {
      if (err instanceof AuthApiError) {
        const { fieldErrors, hasUnmapped } = mapFieldErrors(
          err.fields,
          SERVER_FIELDS,
        );
        setServerFieldErrors(fieldErrors);
        if (hasUnmapped) setServerError(err.message);
      } else {
        setServerError("Sign up failed. Please try again.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <h1 className={styles.title}>Create Account</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.formGroup}>
          <label
            className={`${styles.label} ${styles.required}`}
            htmlFor="username"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            className={inputClass("username")}
            value={values.username}
            onChange={handleChange("username")}
            placeholder="yourname"
            maxLength={USERNAME_MAX}
            required
          />
          {fieldError("username") && (
            <span className={styles.errorText} aria-live="polite">
              {fieldError("username")}
            </span>
          )}
        </div>

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
            value={values.email}
            onChange={handleChange("email")}
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
            value={values.password}
            onChange={handleChange("password")}
            placeholder="••••••••"
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            required
          />
          {fieldError("password") && (
            <span className={styles.errorText} aria-live="polite">
              {fieldError("password")}
            </span>
          )}
        </div>

        <div className={styles.formGroup}>
          <label
            className={`${styles.label} ${styles.required}`}
            htmlFor="password-conf"
          >
            Confirm Password
          </label>
          <input
            id="password-conf"
            type="password"
            className={inputClass("confirm")}
            value={values.confirm}
            onChange={handleChange("confirm")}
            placeholder="••••••••"
            disabled={confirmDisabled}
            required
          />
          {fieldError("confirm") && (
            <span className={styles.errorText} aria-live="polite">
              {fieldError("confirm")}
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
          {submitting ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p className={styles.toggleText}>
        Already have an account?
        <button
          type="button"
          onClick={onToggleMode}
          className={styles.toggleLink}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
