"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  customerRecoveryInvalidMessage,
  customerRecoveryRequestMessage,
  customerRecoveryResetMessage,
  customerRecoveryUnavailableMessage,
} from "@/lib/customer-recovery";

export function CustomerRecoveryForm({ token }: { token?: string }) {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    if (token) {
      if (password !== data.get("confirmation")) {
        setNotice("The passwords do not match.");
        return;
      }
      if (password.length < 10 || new TextEncoder().encode(password).length > 72) {
        setNotice("Use at least 10 characters and no more than 72 UTF-8 bytes.");
        return;
      }
    }

    active.current = true;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/account/${token ? "reset-password" : "forgot-password"}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          token
            ? { token, password }
            : { email: String(data.get("email") ?? "").trim() },
        ),
      });
      const result: unknown = await response.json().catch(() => null);
      const record = result && typeof result === "object" && !Array.isArray(result)
        ? result as Record<string, unknown>
        : null;

      if (response.ok && record?.ok === true) {
        setDone(true);
        if (token) window.history.replaceState(null, "", "/account/reset-password");
        setNotice(token ? customerRecoveryResetMessage : customerRecoveryRequestMessage);
      } else if (response.status === 429) {
        setNotice("Too many recovery attempts. Try again later.");
      } else if (response.status === 400 && token) {
        setNotice(customerRecoveryInvalidMessage);
      } else if (response.status === 400) {
        setNotice("Enter a valid email address.");
      } else {
        setNotice(customerRecoveryUnavailableMessage);
      }
    } catch {
      setNotice(customerRecoveryUnavailableMessage);
    } finally {
      if (token) form.reset();
      active.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6">
      {!done && (
        <form className="space-y-5" onSubmit={submit} aria-busy={pending}>
          {token ? (
            <>
              <p id="customer-password-requirements" className="text-sm text-muted">
                Use at least 10 characters and no more than 72 UTF-8 bytes.
              </p>
              <label className="block text-sm font-medium">
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  aria-describedby="customer-password-requirements"
                  disabled={pending}
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5"
                />
              </label>
              <label className="block text-sm font-medium">
                Confirm new password
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  disabled={pending}
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5"
                />
              </label>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Enter the email address used for your website account. If an account matches, we’ll send a recovery link.
              </p>
              <label className="block text-sm font-medium">
                Account email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={pending}
                  className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5"
                />
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-zayan-blue px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Please wait…" : token ? "Reset password" : "Send recovery link"}
          </button>
        </form>
      )}
      {notice && (
        <p role={done ? "status" : "alert"} aria-live="polite" className="mt-5 text-sm">
          {notice}
        </p>
      )}
      <p className="mt-6 text-sm">
        <Link href="/account" className="underline">Back to customer sign in</Link>
      </p>
      {token && !done && (
        <p className="mt-3 text-sm">
          <Link href="/account/forgot-password" className="underline">Request a new recovery link</Link>
        </p>
      )}
    </div>
  );
}
