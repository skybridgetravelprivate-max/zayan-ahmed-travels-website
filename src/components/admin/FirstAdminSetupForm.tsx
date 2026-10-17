"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type SetupStatus = "loading" | "available" | "unavailable" | "error";
type Notice = { tone: "success" | "error"; message: string };

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";
const fieldClass = "block text-sm font-medium text-foreground";

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

function setupErrorMessage(body: Record<string, unknown>) {
  const message = body.message;
  if (message === "Password must be at least 10 characters") return message;
  if (message === "Invalid setup token.") return message;
  if (message === "Initial administrator setup is already complete.") return message;
  if (message === "Initial setup is unavailable.") return message;
  return "Setup could not be completed. Check the submitted fields and local backend configuration.";
}

export function FirstAdminSetupForm() {
  const pendingRef = useRef(false);
  const [status, setStatus] = useState<SetupStatus>("loading");
  const [pending, setPending] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/setup/first-admin/status", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const body = await responseBody(response);
        if (!response.ok || typeof body.available !== "boolean") throw new Error("Status unavailable");
        if (active) setStatus(body.available ? "available" : "unavailable");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    if (password !== passwordConfirmation) {
      setNotice({ tone: "error", message: "Passwords do not match." });
      setPassword("");
      setPasswordConfirmation("");
      pendingRef.current = false;
      setPending(false);
      return;
    }
    let accountCreated = false;
    try {
      const response = await fetch("/api/setup/first-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "same-origin",
        body: JSON.stringify({ setupToken, fullName, email, username, password }),
      });
      const body = await responseBody(response);
      if (!response.ok || body.ok !== true) {
        setNotice({ tone: "error", message: setupErrorMessage(body) });
        setPassword("");
        return;
      }

      setSetupToken("");
      setPassword("");
      setPasswordConfirmation("");
      setStatus("unavailable");
      accountCreated = true;

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "same-origin",
        body: JSON.stringify({ identifier: email.trim().toLowerCase(), password }),
      });
      const loginBody = await responseBody(loginResponse);
      if (!loginResponse.ok || loginBody.ok !== true) {
        setNotice({
          tone: "error",
          message: "Administrator created and setup is disabled, but staff sign-in verification failed. Check the local JWT configuration.",
        });
        return;
      }

      const protectedResponse = await fetch("/api/v1/meta/resources", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "same-origin",
      });
      if (!protectedResponse.ok) {
        setNotice({
          tone: "error",
          message: "Administrator created and staff sign-in succeeded, but protected API verification failed.",
        });
        return;
      }

      setNotice({
        tone: "success",
        message: "Administrator created. Staff sign-in and protected API access were verified; this browser is signed in.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: accountCreated
          ? "Administrator was created, but sign-in verification could not reach the local backend."
          : "The setup request could not reach the local backend. Check that connected development is running.",
      });
    } finally {
      setSetupToken("");
      setPassword("");
      setPasswordConfirmation("");
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (status === "loading") {
    return <p role="status" className="mt-6 text-sm text-muted">Checking setup availability…</p>;
  }
  if (status === "unavailable") {
    return (
      <div className="mt-6 rounded-xl border border-line bg-background p-4" role="status">
        <p className="font-semibold">Initial setup is unavailable.</p>
        <p className="mt-1 text-sm text-muted">A staff account already exists or the private setup token is not configured.</p>
        {notice ? <p className="mt-3 text-sm font-medium text-zayan-blue">{notice.message}</p> : null}
      </div>
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="mt-6 text-sm font-medium text-red-700">
        Could not check setup availability. Confirm the local backend and database connection, then reload this page.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <form className="space-y-4" onSubmit={onSubmit} aria-busy={pending}>
        <Field id="first-admin-token" label="Private setup token" type="password" autoComplete="off" value={setupToken} disabled={pending} onChange={setSetupToken} />
        <Field id="first-admin-name" label="Full name" autoComplete="name" value={fullName} disabled={pending} onChange={setFullName} />
        <Field id="first-admin-email" label="Email" type="email" autoComplete="email" value={email} disabled={pending} onChange={setEmail} />
        <Field id="first-admin-username" label="Username" autoComplete="username" value={username} disabled={pending} onChange={setUsername} />
        <Field id="first-admin-password" label="Password (at least 10 characters)" type="password" autoComplete="new-password" value={password} disabled={pending} onChange={setPassword} />
        <Field id="first-admin-password-confirmation" label="Confirm password" type="password" autoComplete="new-password" value={passwordConfirmation} disabled={pending} onChange={setPasswordConfirmation} />
        <button
          type="submit"
          disabled={pending || !setupToken || !fullName || !email || !username || !password || !passwordConfirmation}
          className="rounded-xl bg-zayan-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-zayan-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Setting up administrator…" : "Create initial administrator"}
        </button>
      </form>
      {notice ? (
        <p role={notice.tone === "error" ? "alert" : "status"} className="mt-4 text-sm font-medium">
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
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className={fieldClass}>
      {label}
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        required
      />
    </label>
  );
}
