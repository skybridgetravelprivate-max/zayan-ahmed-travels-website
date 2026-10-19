import { LoginForm } from "@/components/account/LoginForm";
import { ProfileSummary, type AccountIdentity } from "@/components/account/ProfileSummary";
import { RegisterForm } from "@/components/account/RegisterForm";
import { Button } from "@/components/ui/Button";

export function AccountHome({ customer }: { customer: AccountIdentity | null }) {
  return <div className="space-y-8">
    <ProfileSummary customer={customer} />
    <section className="grid gap-5 sm:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-6"><h2 className="text-xl font-bold text-zayan-blue">My bookings</h2><p className="my-3 text-muted">{customer ? "View the bookings linked to your account." : "Sign in to access your linked bookings."}</p><Button href="/my-bookings">View my bookings</Button></div>
      <div className="rounded-2xl border border-line bg-surface p-6"><h2 className="text-xl font-bold text-zayan-blue">Need assistance?</h2><p className="my-3 text-muted">Contact the travel desk about your trip. Public inquiries are handled by the desk and are not listed in your account.</p><Button href="/contact" variant="outline">Contact the travel desk</Button></div>
    </section>
    {!customer && <section className="grid gap-8 rounded-3xl border border-line bg-surface p-6 lg:grid-cols-2">
      <div><h2 className="text-lg font-bold text-zayan-blue">Create an account</h2><p className="mb-4 mt-1 text-sm text-muted">Register with your email, then sign in.</p><RegisterForm /></div>
      <div><h2 className="text-lg font-bold text-zayan-blue">Sign in</h2><p className="mb-4 mt-1 text-sm text-muted">Use your website account email and password.</p><LoginForm /></div>
    </section>}
  </div>;
}
