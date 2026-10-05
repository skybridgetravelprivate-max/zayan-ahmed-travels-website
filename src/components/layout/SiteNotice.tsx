/** Optional banner from NEXT_PUBLIC_SITE_NOTICE (e.g. Hostinger test site label). */
export function SiteNotice() {
  const message = process.env.NEXT_PUBLIC_SITE_NOTICE?.trim();
  if (!message) return null;

  return (
    <div
      role="status"
      className="border-b border-zayan-orange/30 bg-zayan-orange/10 px-4 py-2 text-center text-sm font-medium text-zayan-blue"
    >
      {message}
    </div>
  );
}
