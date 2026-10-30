"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

/** Uses the existing staff token endpoints; website customer identity is separate. */
export function StaffRecoveryForm({ token }: { token?: string }) {
  const [pending, setPending] = useState(false), [notice, setNotice] = useState(""), [done, setDone] = useState(false);
  const active = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (active.current) return;
    const form = event.currentTarget, data = new FormData(form);
    if (token) {
      const password = String(data.get("password") || "");
      if (password !== data.get("confirmation")) { setNotice("The passwords do not match."); return; }
      if (password.length < 10 || new TextEncoder().encode(password).length > 72) { setNotice("Use at least 10 characters and no more than 72 UTF-8 bytes."); return; }
    }
    active.current = true; setPending(true); setNotice("");
    try {
      const response = await fetch(`/api/auth/${token ? "reset-password" : "forgot-password"}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token, password: data.get("password") } : { email: String(data.get("email") || "").trim() }) });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) {
        setDone(true);
        if (token) { window.history.replaceState(null, "", "/reset-password"); setNotice("Your staff password was reset. Previous staff sessions have been revoked. Sign in with your new password."); }
        else setNotice("If an eligible staff account matches and email delivery succeeds, you will receive a recovery link. If no message arrives, contact your administrator. Website customer accounts use separate recovery.");
      } else setNotice(response.status === 429 ? "Too many attempts. Wait a minute before trying again." : response.status === 503 ? "Staff recovery email is unavailable. Contact your administrator." : token && response.status === 400 ? "This link is invalid, expired or already used, or the password does not meet the requirements. Request a new link if needed." : "Recovery could not be completed. Try again later or contact your administrator.");
    } catch { setNotice("Could not reach staff recovery. Check your connection and try again. If a reset outcome is uncertain, try signing in before resubmitting."); }
    finally { if (token) form.reset(); active.current = false; setPending(false); }
  }
  return <>
    {!done && <form onSubmit={submit} aria-busy={pending} className="mt-6 space-y-5">
      {token ? <>
        <p id="password-requirements" className="text-sm text-muted">Use at least 10 characters and no more than 72 UTF-8 bytes. Longer non-Latin characters may use several bytes.</p>
        <label className="block font-medium">New staff password<input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} aria-describedby="password-requirements" disabled={pending} className="mt-2 w-full rounded-xl border border-line p-3" /></label>
        <label className="block font-medium">Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={72} disabled={pending} className="mt-2 w-full rounded-xl border border-line p-3" /></label>
      </> : <label className="block font-medium">Staff email<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} className="mt-2 w-full rounded-xl border border-line p-3" /></label>}
      <button disabled={pending} className="rounded-xl bg-zayan-blue px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Please wait…" : token ? "Reset staff password" : "Request recovery link"}</button>
    </form>}
    {notice && <p role="status" aria-live="polite" className="mt-5 break-words">{notice}</p>}
    <p className="mt-6"><Link href="/admin/login" className="underline">Back to staff sign in</Link></p>
    {token && !done && <p className="mt-3"><Link href="/admin/forgot-password" className="underline">Request a new recovery link</Link></p>}
  </>;
}
