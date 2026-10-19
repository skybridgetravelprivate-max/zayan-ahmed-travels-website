import { agencyBrand } from "../../../backend/packages/config/agency-brand.cjs";

export function AgencyMasthead() {
  return <header className="mb-6 overflow-hidden rounded-2xl border border-line bg-white">
    <div className="flex flex-wrap items-center gap-4 bg-zayan-blue px-5 py-5 text-white">
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 font-bold text-zayan-orange">ZA</span>
      <div className="min-w-0"><p className="text-lg font-bold sm:text-xl">{agencyBrand.name}</p><p className="mt-1 text-sm text-white/80">{agencyBrand.tagline}</p></div>
    </div>
    <address className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-3 text-xs not-italic text-muted"><span>{agencyBrand.address}</span><a href="tel:+923121558860" className="underline">{agencyBrand.phone}</a><a href={`mailto:${agencyBrand.email}`} className="break-all underline">{agencyBrand.email}</a><a href={agencyBrand.website} className="break-all underline">www.zayanahmedtravels.com</a></address>
  </header>;
}
