"use client";
import { useRef, useState, type FormEvent } from "react";

export function StaffLoginForm() {
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const active = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    active.current = true; setPending(true); setNotice("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: String(fields.get("identifier") || "").trim(), password: fields.get("password"), rememberMe: fields.get("remember") === "on" }) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true) { window.location.assign("/admin"); return; }
      setNotice(response.status === 429 ? "Too many attempts. Wait a minute and try again." : response.status === 401 ? "Sign-in failed. Check your username and password, or try later if your account is locked." : "Staff sign-in is temporarily unavailable. Try again later.");
    } catch { setNotice("Could not reach staff sign-in. Try again later."); }
    finally {
      const password = form.elements.namedItem("password") as HTMLInputElement | null;
      if (password) password.value = "";
      active.current = false; setPending(false);
    }
  }
  return <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={pending}>
    <label className="block text-sm font-medium">Email or username<input name="identifier" required autoComplete="username" maxLength={254} className="mt-2 w-full rounded-xl border border-line bg-background p-3" disabled={pending} /></label>
    <label className="block text-sm font-medium">Password<input name="password" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-line bg-background p-3" disabled={pending} /></label>
    <label className="flex items-center gap-2 text-sm"><input name="remember" type="checkbox" disabled={pending} />Keep me signed in</label>
    <button disabled={pending} className="rounded-xl bg-zayan-blue px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Signing in…" : "Staff sign in"}</button>
    {notice && <p role="alert" className="text-sm text-red-700">{notice}</p>}
  </form>;
}

export function StaffLogoutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function logout() {
    setPending(true); setFailed(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      window.location.assign("/admin/login");
    } catch { setFailed(true); setPending(false); }
  }
  return <div><button onClick={logout} disabled={pending} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold disabled:opacity-60">{pending ? "Signing out…" : "Sign out"}</button>{failed && <p role="alert">Sign out failed. Please try again.</p>}</div>;
}
