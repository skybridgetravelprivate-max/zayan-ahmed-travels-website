"use client";

import { useState } from "react";
import { AccountState } from "@/components/account/AccountState";
import { LoginForm } from "@/components/account/LoginForm";
import { ProfileSummary, type AccountIdentity } from "@/components/account/ProfileSummary";
import { RegisterForm } from "@/components/account/RegisterForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { accountPanels, type AccountPanel } from "@/config/account";

export function AccountHome({ customer }: { customer: AccountIdentity | null }) {
  const [panel, setPanel] = useState<AccountPanel | null>(null);
  const active = accountPanels.find((item) => item.id === panel);
  const signedIn = customer !== null;

  return (
    <div className="space-y-8">
      <ProfileSummary customer={customer} />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Card
            title="My bookings"
            description={
              signedIn
                ? "Open your booking list."
                : "Sign in to view bookings. Sample trips are not shown as your bookings."
            }
          >
            <Button href="/my-bookings">My bookings</Button>
          </Card>
        </li>
        {accountPanels.map((item) => (
          <li key={item.id}>
            <Card
              title={item.title}
              description={signedIn ? "Not connected to your account yet." : "Demo section. Nothing is stored or sent."}
            >
              <Button
                variant={panel === item.id ? "secondary" : "outline"}
                aria-pressed={panel === item.id}
                onClick={() => setPanel(panel === item.id ? null : item.id)}
              >
                {item.title}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      {active ? (
        <AccountState
          status="empty"
          title={active.title}
          message={signedIn ? "Nothing is stored here yet." : active.empty}
        />
      ) : null}

      <AccountState
        status="empty"
        title="No inquiries in this account"
        message={
          signedIn
            ? "Questions sent from the public forms are not listed on this account."
            : "Questions sent from the public forms are not listed here. This sample account does not store an inquiry."
        }
      />

      {signedIn ? null : (
      <section className="grid gap-8 rounded-3xl border border-line bg-surface p-6 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="text-lg font-bold text-zayan-blue">Create an account</h2>
          <p className="mt-1 text-sm text-muted">
            Save a display name, email, and password on this website. Registration does not sign you in.
          </p>
          <RegisterForm />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zayan-blue">Sign in</h2>
          <p className="mt-1 text-sm text-muted">
            Sign in with the email and password for this website.
          </p>
          <LoginForm />
        </div>
      </section>
      )}
    </div>
  );
}
