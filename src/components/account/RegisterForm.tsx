"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  registrationSuccessMessage,
  registrationUnavailableMessage,
  validateRegistration,
} from "@/lib/registration";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

const allowedFieldMessages = new Set([
  "Enter a display name.",
  "Use a display name of 80 characters or fewer.",
  "Enter an email address.",
  "Enter a valid email address.",
  "Enter a password.",
  "Use at least 10 characters.",
  "Use 72 characters or fewer.",
  "Use a shorter password.",
  "Confirm your password.",
  "Passwords do not match.",
]);

type Notice = { tone: "success" | "error"; message: string };

function fieldMessage(fields: Record<string, unknown> | undefined, key: string) {
  const value = fields?.[key];
  return typeof value === "string" && allowedFieldMessages.has(value) ? value : undefined;
}

export function RegisterForm() {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  function clearPasswords() {
    setPassword("");
    setConfirmPassword("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    const payload = { displayName, email, password, confirmPassword };
    const parsed = validateRegistration(payload);
    if (!parsed.ok) {
      setFields(parsed.fields ?? {});
      setNotice({ tone: "error", message: parsed.error });
      clearPasswords();
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    setFields({});

    try {
      const response = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json().catch(() => null);
      const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
      const responseFields =
        record?.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
          ? (record.fields as Record<string, unknown>)
          : undefined;
      const nextFields = {
        displayName: fieldMessage(responseFields, "displayName"),
        email: fieldMessage(responseFields, "email"),
        password: fieldMessage(responseFields, "password"),
        confirmPassword: fieldMessage(responseFields, "confirmPassword"),
      };
      const visibleFields = Object.fromEntries(
        Object.entries(nextFields).flatMap(([key, message]) => (message ? [[key, message]] : [])),
      );

      if (response.ok && record?.ok === true && record.message === registrationSuccessMessage) {
        setDisplayName("");
        setEmail("");
        clearPasswords();
        setFields({});
        setNotice({ tone: "success", message: registrationSuccessMessage });
        return;
      }

      setFields(visibleFields);
      const error = typeof record?.error === "string" ? record.error : "";
      const message =
        error === "Check the registration fields." || error === registrationUnavailableMessage
          ? error
          : registrationUnavailableMessage;
      setNotice({ tone: "error", message });
      clearPasswords();
    } catch {
      setNotice({ tone: "error", message: registrationUnavailableMessage });
      clearPasswords();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={onSubmit} aria-busy={pending} noValidate>
      <Field
        id="register-display-name"
        label="Display name"
        autoComplete="name"
        value={displayName}
        error={fields.displayName}
        disabled={pending}
        onChange={setDisplayName}
      />
      <Field
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={fields.email}
        disabled={pending}
        onChange={setEmail}
      />
      <Field
        id="register-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        error={fields.password}
        disabled={pending}
        onChange={setPassword}
      />
      <Field
        id="register-confirm-password"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        error={fields.confirmPassword}
        disabled={pending}
        onChange={setConfirmPassword}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Register"}
      </Button>
      {notice ? (
        <p role={notice.tone === "error" ? "alert" : "status"} className="text-sm font-medium text-zayan-blue">
          {notice.message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  value,
  error,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {label}
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm font-medium text-zayan-blue">
          {error}
        </p>
      ) : null}
    </label>
  );
}
