import { SignOutButton } from "@/components/account/LoginForm";
import { site } from "@/config/site";

export type AccountIdentity = {
  displayName: string;
  email: string;
};

export function ProfileSummary({ customer }: { customer: AccountIdentity | null }) {
  if (!customer) {
    return (
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">Your account</p>
        <h2 className="mt-2 text-2xl font-bold text-zayan-blue">Welcome to {site.shortName}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Sign in below to view your account details and linked bookings, or create an account to get started.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">Signed in</p>
      <h2 className="mt-2 text-2xl font-bold text-zayan-blue">{customer.displayName}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        This is your {site.shortName} account.
      </p>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Display name</dt>
          <dd className="mt-1 font-semibold text-foreground">{customer.displayName}</dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="mt-1 font-semibold text-foreground">{customer.email}</dd>
        </div>
        <div>
          <dt className="text-muted">Account</dt>
          <dd className="mt-1 font-semibold text-foreground">Signed in</dd>
        </div>
      </dl>
      <SignOutButton />
    </section>
  );
}
