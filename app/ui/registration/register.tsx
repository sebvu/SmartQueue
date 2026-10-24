import { useState } from "react";
import styles from "./registration.module.css";
import {
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./authValidation";

interface RegisterProps {
  onToggleMode: () => void;
}

type Field = "username" | "email" | "password" | "confirm";

// TODO: replace with the real register API call (POST).
async function registerUser(data: {
  username: string;
  email: string;
  password: string;
}): Promise<void> {
  console.log("registerUser called with", data);
  throw new Error("Register API is not connected yet.");
}

export default function Register({ onToggleMode }: RegisterProps) {
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

  const handleChange =
    (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setTouched((t) => ({ ...t, [field]: true }));
    };

  const showError = (field: Field) => touched[field] && errors[field];

  const inputClass = (field: Field) => {
    if (!touched[field] || (field === "confirm" && confirmDisabled)) {
      return styles.input;
    }
    return `${styles.input} ${errors[field] ? styles.inputError : styles.inputValid}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, confirm: true });
    setServerError("");

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
      await registerUser({
        username: values.username.trim(),
        email: values.email,
        password: values.password,
      });
      onToggleMode(); // registered: send them to the login view
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
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
            required
          />
          {showError("username") && (
            <span className={styles.errorText} aria-live="polite">
              {errors.username}
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
          {showError("email") && (
            <span className={styles.errorText} aria-live="polite">
              {errors.email}
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
            minLength={8}
            maxLength={20}
            required
          />
          {showError("password") && (
            <span className={styles.errorText} aria-live="polite">
              {errors.password}
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
          {!confirmDisabled && showError("confirm") && (
            <span className={styles.errorText} aria-live="polite">
              {errors.confirm}
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
