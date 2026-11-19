import type { Metadata } from "next";
import Link from "next/link";
import { AccountFrame } from "@/components/account/AccountFrame";
import { CustomerRecoveryForm } from "@/components/account/CustomerRecoveryForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset customer password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetCustomerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const validToken = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);

  return (
    <AccountFrame
      current="account"
      title="Reset your password"
      intro="Choose a new password for your customer account."
    >
      {validToken ? (
        <CustomerRecoveryForm token={token} />
      ) : (
        <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6">
          <p role="status">Open the full recovery link from your email, or request a new one.</p>
          <Link href="/account/forgot-password" className="mt-4 inline-block underline">
            Request a new recovery link
          </Link>
        </div>
      )}
    </AccountFrame>
  );
}
