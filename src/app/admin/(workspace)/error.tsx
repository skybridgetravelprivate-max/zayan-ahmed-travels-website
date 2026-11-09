"use client";

export default function StaffWorkspaceError({ retry }: { retry: () => void }) {
  return (
    <section role="alert" className="rounded-xl border border-line bg-surface p-6">
      <h1 className="text-xl font-bold text-zayan-blue">This workspace could not be loaded</h1>
      <p className="mt-2 text-muted">Try loading the page again.</p>
      <button type="button" onClick={retry} className="mt-4 rounded-lg bg-zayan-blue px-4 py-2 text-white">
        Try again
      </button>
    </section>
  );
}
