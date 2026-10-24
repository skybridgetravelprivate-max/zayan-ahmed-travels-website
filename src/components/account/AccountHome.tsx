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
                : "Sign in to view your bookings."
            }
          >
            <Button href="/my-bookings">My bookings</Button>
          </Card>
        </li>
        {accountPanels.map((item) => (
          <li key={item.id}>
            <Card
              title={item.title}
              description={item.id === "support" ? "Contact our team about your trip." : "Our team can help with this service."}
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
        <section className="space-y-4">
        <AccountState
          status="empty"
          title={active.title}
          message={active.empty}
        />
        <Button href="/contact">Contact agency</Button>
        </section>
      ) : null}

      <AccountState
        status="empty"
        title="Need help with an inquiry?"
        message={
          signedIn
            ? "Contact our team with your booking or inquiry reference for an update."
            : "Contact our team for assistance with an inquiry or an existing booking."
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
