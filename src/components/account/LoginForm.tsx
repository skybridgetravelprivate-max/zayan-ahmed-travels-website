"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  loginFailureMessage,
  loginSuccessMessage,
  loginUnavailableMessage,
  logoutSuccessMessage,
  logoutUnavailableMessage,
  validateLogin,
} from "@/lib/login";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

const allowedFieldMessages = new Set([
  "Enter an email address.",
  "Enter a valid email address.",
  "Enter a password.",
  "Use a shorter password.",
]);

type Notice = { tone: "success" | "error"; message: string };

function fieldMessage(fields: Record<string, unknown> | undefined, key: string) {
  const value = fields?.[key];
  return typeof value === "string" && allowedFieldMessages.has(value) ? value : undefined;
}

export function LoginForm() {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    const payload = { email, password };
    const parsed = validateLogin(payload);
    if (!parsed.ok) {
      setFields(parsed.fields ?? {});
      setNotice({ tone: "error", message: parsed.error });
      setPassword("");
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    setFields({});

    try {
      const response = await fetch("/api/account/login", {
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

      if (response.ok && record?.ok === true && record.message === loginSuccessMessage) {
        setPassword("");
        setFields({});
        setNotice({ tone: "success", message: loginSuccessMessage });
        router.refresh();
        return;
      }

      const nextFields = {
        email: fieldMessage(responseFields, "email"),
        password: fieldMessage(responseFields, "password"),
      };
      setFields(Object.fromEntries(Object.entries(nextFields).flatMap(([key, message]) => (message ? [[key, message]] : []))));
      const error = typeof record?.error === "string" ? record.error : "";
      const message =
        error === "Check the sign-in fields." || error === loginFailureMessage || error === loginUnavailableMessage
          ? error
          : loginUnavailableMessage;
      setNotice({ tone: "error", message });
      setPassword("");
    } catch {
      setNotice({ tone: "error", message: loginUnavailableMessage });
      setPassword("");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <form className="space-y-4" onSubmit={onSubmit} aria-busy={pending} noValidate>
        <Field
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fields.email}
          disabled={pending}
          onChange={setEmail}
        />
        <Field
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fields.password}
          disabled={pending}
          onChange={setPassword}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign In"}
          </Button>
        </div>
      </form>
      {notice ? (
        <p role={notice.tone === "error" ? "alert" : "status"} className="mt-3 text-sm font-medium text-zayan-blue">
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function onLogout() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/account/logout", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
      if (response.ok && record?.ok === true && record.message === logoutSuccessMessage) {
        router.refresh();
        return;
      }
      setNotice({ tone: "error", message: logoutUnavailableMessage });
    } catch {
      setNotice({ tone: "error", message: logoutUnavailableMessage });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-6">
      <Button type="button" variant="outline" disabled={pending} onClick={onLogout}>
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {notice ? (
        <p role="alert" className="mt-3 text-sm font-medium text-zayan-blue">
          {notice.message}
        </p>
      ) : null}
    </div>
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
