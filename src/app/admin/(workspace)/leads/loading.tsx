export default function StaffLeadsLoading() {
  return (
    <section aria-busy="true" aria-label="Loading lead records">
      <h1 className="text-3xl font-bold text-zayan-blue">Inquiries and leads</h1>
      <p role="status" className="mt-4 text-sm text-muted">
        Loading authorized lead records…
      </p>
      <div className="mt-6 h-14 animate-pulse rounded-2xl bg-surface" />
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-surface" />
    </section>
  );
}
