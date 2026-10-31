import Link from "next/link";
import { StaffLoginForm } from "./StaffSessionForm";

const portals = [
  { portal: "super-admin", label: "Super Admin", href: "/admin/login/super-admin", description: "Global administration, roles and permissions, subject to existing safeguards." },
  { portal: "admin", label: "Admin", href: "/admin/login", description: "Administration within your existing assigned permissions and branches." },
  { portal: "staff", label: "Staff", href: "/admin/login/staff", description: "Your assigned operational modules and authorized branches." },
] as const;

export function LoginPortalPage({ portal }: { portal: typeof portals[number]["portal"] }) {
  const current = portals.find(item => item.portal === portal)!;
  return <section className="mx-auto max-w-lg px-4 py-12"><div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
    <p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">{current.label} portal</p>
    <h1 className="mt-2 text-3xl font-bold text-zayan-blue">{current.label} sign in</h1>
    <p className="mt-3 text-sm text-muted">{current.description} Use your existing credentials. Access comes from your assigned role, never from the portal you select.</p>
    <StaffLoginForm portal={portal} label={current.label} />
    <nav aria-label="Choose sign-in portal" className="mt-6 flex flex-wrap gap-4">{portals.map(item => <Link key={item.portal} href={item.href} aria-current={portal === item.portal ? "page" : undefined} className="text-sm underline">{item.label} sign in</Link>)}</nav>
    <p className="mt-6 text-sm text-muted"><Link href="/admin/forgot-password" className="underline">Forgot your password?</Link> Recovery uses your existing staff account.</p>
    <Link href="/account" className="mt-4 inline-block text-sm underline">Customer sign in</Link>
  </div></section>;
}
