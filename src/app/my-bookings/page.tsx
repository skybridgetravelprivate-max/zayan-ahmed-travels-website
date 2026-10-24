import type { Metadata } from "next";
import { connection } from "next/server";
import { AccountFrame } from "@/components/account/AccountFrame";
import { AccountState } from "@/components/account/AccountState";
import { LoginForm } from "@/components/account/LoginForm";
import { MyBookingsClient } from "@/components/account/MyBookingsClient";
import { Button } from "@/components/ui/Button";
import { site } from "@/config/site";
import { getCurrentCustomer } from "@/server/customer-auth/session";

export const metadata: Metadata = {
  title: "My bookings",
  description: `Bookings for a ${site.legalName} account.`,
  robots: { index: false, follow: false },
};

export default async function MyBookingsPage() {
  await connection();
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <AccountFrame
        current="bookings"
        title="My bookings"
        intro="Sign in to view bookings for your account."
      >
        <div className="space-y-8">
          <AccountState
            status="empty"
            title="Sign in to view bookings"
            message="Sign in to view the bookings linked to your account."
          />
          <section className="max-w-xl rounded-3xl border border-line bg-surface p-6">
            <h2 className="text-lg font-bold text-zayan-blue">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Use the email and password for this website.</p>
            <LoginForm />
            <div className="mt-4">
              <Button href="/account" variant="outline">
                Create an account
              </Button>
            </div>
          </section>
        </div>
      </AccountFrame>
    );
  }

  return (
    <AccountFrame
      current="bookings"
      title="My bookings"
      intro={`Signed in as ${customer.displayName}. Bookings for this account load from your website session.`}
    >
      <MyBookingsClient />
    </AccountFrame>
  );
}
