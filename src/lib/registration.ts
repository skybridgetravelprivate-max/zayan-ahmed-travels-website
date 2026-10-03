const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registrationSuccessMessage = "Your account was created.";
export const registrationUnavailableMessage = "Registration could not be completed. Try again later.";

export type RegistrationInput = {
  displayName: string;
  email: string;
  password: string;
};

export type RegistrationFailure = {
  ok: false;
  error: string;
  fields?: Record<string, string>;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCustomerEmail(value: unknown) {
  return text(value).toLowerCase();
}

export function validateRegistration(
  body: unknown,
): { ok: true; data: RegistrationInput } | RegistrationFailure {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send the registration as JSON." };
  }

  const record = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const displayName = text(record.displayName);
  const email = normalizeCustomerEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";
  const confirmPassword = typeof record.confirmPassword === "string" ? record.confirmPassword : "";

  if (!displayName) fields.displayName = "Enter a display name.";
  else if (displayName.length > 80) fields.displayName = "Use a display name of 80 characters or fewer.";

  if (!email) fields.email = "Enter an email address.";
  else if (email.length > 120 || !emailPattern.test(email)) fields.email = "Enter a valid email address.";

  if (!password) fields.password = "Enter a password.";
  else if (password.length < 10) fields.password = "Use at least 10 characters.";
  else if (password.length > 72) fields.password = "Use 72 characters or fewer.";

  if (!confirmPassword) fields.confirmPassword = "Confirm your password.";
  else if (password && confirmPassword !== password) fields.confirmPassword = "Passwords do not match.";

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "Check the registration fields.", fields };
  }

  return { ok: true, data: { displayName, email, password } };
}
