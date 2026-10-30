import type { Metadata } from "next";
import { StaffRecoveryForm } from "@/components/admin/StaffRecoveryForm";
export const metadata: Metadata = { title: "Staff password recovery", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function ForgotStaffPassword() {
  return <section className="mx-auto max-w-lg px-4 py-12"><h1 className="text-3xl font-bold">Staff password recovery</h1><p className="mt-3">Recovery is for existing staff accounts. Email delivery must be configured by your administrator; this form does not activate it.</p><StaffRecoveryForm /></section>;
}
