import type { Metadata } from "next";
import Link from "next/link";
import { StaffRecoveryForm } from "@/components/admin/StaffRecoveryForm";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset staff password", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ResetStaffPassword({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  return <section className="mx-auto max-w-lg px-4 py-12"><h1 className="text-3xl font-bold">Reset staff password</h1><p className="mt-3">This page resets an existing staff account. It does not reset website customer passwords.</p>{valid ? <StaffRecoveryForm token={token} /> : <p role="status" className="mt-6">Open the full recovery link from your email, or <Link className="underline" href="/admin/forgot-password">request a new recovery link</Link>.</p>}</section>;
}
