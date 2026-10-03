import type { Metadata } from "next";
import { connection } from "next/server";
import { AccountFrame } from "@/components/account/AccountFrame";
import { AccountHome } from "@/components/account/AccountHome";
import { site } from "@/config/site";
import { getCurrentCustomer } from "@/server/customer-auth/session";

export const metadata: Metadata = {
  title: "Account",
  description: `Account for ${site.legalName}`,
};

export default async function AccountPage() {
  await connection();
  const customer = await getCurrentCustomer();
  const identity = customer ? { displayName: customer.displayName, email: customer.email } : null;

  return (
    <AccountFrame
      current="account"
      title={identity ? identity.displayName : "Welcome"}
      intro={
        identity
          ? "You are signed in to this website."
          : "Sign in to see your account. A sample profile is shown until you do."
      }
    >
      <AccountHome customer={identity} />
    </AccountFrame>
  );
}
