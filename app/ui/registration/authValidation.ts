export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const SPECIAL_CHARACTER_REGEX = /[#?!@$%^&*-]/;
const DIGIT_REGEX = /[0-9]/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 20;

export function validateEmail(value: string): string {
  if (value.length === 0) return "Please enter your email.";
  if (!EMAIL_REGEX.test(value)) return "Value needs to be an email address.";
  return "";
}

export function validateUsername(value: string): string {
  if (value.trim().length === 0) return "Please enter a username.";
  if (value.trim().length < 3) return "Username must be at least 3 characters.";
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
