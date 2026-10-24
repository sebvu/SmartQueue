import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./registration.module.css";
import { validateEmail } from "./authValidation";

interface LoginProps {
  onToggleMode: () => void;
}

// TODO: replace with the real login API call.
// It should POST the credentials and resolve with the session ID.
async function loginUser(email: string, password: string): Promise<string> {
  console.log("loginUser called with", { email, password });
  throw new Error("Login API is not connected yet.");
}

export default function Login({ onToggleMode }: LoginProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const errors = {
    email: validateEmail(email),
    password: password.length === 0 ? "Please enter a password." : "",
  };

  const showError = (field: "email" | "password") =>
    touched[field] && errors[field];

  const inputClass = (field: "email" | "password") => {
    if (!touched[field]) return styles.input;
    return `${styles.input} ${errors[field] ? styles.inputError : styles.inputValid}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setServerError("");

    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      const sessionID = await loginUser(email, password);
      localStorage.setItem("sessionID", sessionID);
      router.push("/home");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed.");
    } finally {
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
              setTouched((t) => ({ ...t, email: true }));
            }}
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
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setTouched((t) => ({ ...t, password: true }));
            }}
            placeholder="••••••••"
            required
          />
          {showError("password") && (
            <span className={styles.errorText} aria-live="polite">
              {errors.password}
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
