import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FirstAdminSetupForm } from "@/components/admin/FirstAdminSetupForm";

export const metadata: Metadata = {
  title: "Initial Administrator Setup",
  robots: { index: false, follow: false },
};

export default function FirstAdminSetupPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">Local setup</p>
        <h1 className="mt-2 text-3xl font-bold text-zayan-blue">Create the first staff administrator</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This one-time setup is available only while there are no staff accounts. Enter the private setup token
          configured for the backend and choose the administrator sign-in credentials.
        </p>
        <FirstAdminSetupForm />
      </div>
    </section>
  );
}
