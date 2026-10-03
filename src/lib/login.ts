import { normalizeCustomerEmail } from "@/lib/registration";

export const loginSuccessMessage = "You are signed in.";
export const loginFailureMessage = "The email or password is incorrect.";
export const loginUnavailableMessage = "Sign in could not be completed. Try again later.";
export const logoutSuccessMessage = "You are signed out.";
export const logoutUnavailableMessage = "Sign out could not be completed. Try again later.";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginFailure = {
  ok: false;
  error: string;
  fields?: Record<string, string>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(body: unknown): { ok: true; data: LoginInput } | LoginFailure {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send the sign-in as JSON." };
  }

  const record = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const email = normalizeCustomerEmail(record.email);
  const password = typeof record.password === "string" ? record.password : "";

  if (!email) fields.email = "Enter an email address.";
  else if (email.length > 120 || !emailPattern.test(email)) fields.email = "Enter a valid email address.";

  if (!password) fields.password = "Enter a password.";
  else if (password.length > 72) fields.password = "Use a shorter password.";

  if (Object.keys(fields).length > 0) {
    return { ok: false, error: "Check the sign-in fields.", fields };
  }

  return { ok: true, data: { email, password } };
}
