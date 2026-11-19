import type { Metadata } from "next";
import { AccountFrame } from "@/components/account/AccountFrame";
import { CustomerRecoveryForm } from "@/components/account/CustomerRecoveryForm";

export const metadata: Metadata = {
  title: "Customer password recovery",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ForgotCustomerPasswordPage() {
  return (
    <AccountFrame
      current="account"
      title="Recover your account"
      intro="Request a secure password recovery link for your customer account."
    >
      <CustomerRecoveryForm />
    </AccountFrame>
  );
}
