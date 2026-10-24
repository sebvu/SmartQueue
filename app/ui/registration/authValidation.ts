export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const SPECIAL_CHARACTER_REGEX = /[#?!@$%^&*-]/;
const DIGIT_REGEX = /[0-9]/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128; // server: LIMITS.passwordMax
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 100; // server: LIMITS.nameMax
export const EMAIL_MAX = 255; // server: LIMITS.emailMax

export function validateEmail(value: string): string {
  if (value.length === 0) return "Please enter your email.";
  if (value.length > EMAIL_MAX) {
    return `Email must be at most ${EMAIL_MAX} characters.`;
  }
  if (!EMAIL_REGEX.test(value)) return "Value needs to be an email address.";
  return "";
}

export function validateUsername(value: string): string {
  const text = value.trim();
  if (text.length === 0) return "Please enter a username.";
  if (text.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (text.length > USERNAME_MAX) {
    return `Username must be at most ${USERNAME_MAX} characters.`;
  }
  return "";
}

export function validatePassword(value: string): string {
  if (value.length === 0) return "Please enter a password.";
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    return `Please ensure the length of the password is ${PASSWORD_MIN}-${PASSWORD_MAX}.`;
  }

  const messages: string[] = [];
  if (!SPECIAL_CHARACTER_REGEX.test(value)) {
    messages.push("Include a special character [#?!@$%^&*-].");
  }
  if (!DIGIT_REGEX.test(value)) {
    messages.push("Include one digit [0-9].");
  }
  return messages.join("\n");
}

export function validateConfirmPassword(
  confirm: string,
  password: string,
): string {
  if (confirm.length === 0) return "Please confirm password.";
  if (confirm !== password) return "Passwords do not match.";
  return "";
}
