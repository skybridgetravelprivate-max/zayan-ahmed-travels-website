import type { Metadata } from "next";
import Link from "next/link";
import { StaffLoginForm } from "@/components/admin/StaffSessionForm";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };
export default function StaffLoginPage() {
  return <section className="mx-auto max-w-lg px-4 py-12"><div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
    <p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">Staff workspace</p>
    <h1 className="mt-2 text-3xl font-bold text-zayan-blue">Welcome back</h1>
    <p className="mt-3 text-sm text-muted">Use your existing staff credentials. Customer accounts sign in separately.</p>
    <StaffLoginForm />
    <p className="mt-6 text-sm text-muted">Forgot your password? Contact your administrator for account recovery.</p>
    <Link href="/account" className="mt-4 inline-block text-sm underline">Customer sign in</Link>
  </div></section>;
}
