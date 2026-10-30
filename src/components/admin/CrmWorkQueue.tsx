import Link from "next/link";
import { staffRequest } from "@/server/staff-api";
import { parseCrmQueue } from "@/lib/staff-crm";

export async function CrmWorkQueue() {
  let queue = null;
  try {
    const response = await staffRequest("/api/v1/crm/today");
    if (response?.ok) queue = parseCrmQueue(await response.json());
  } catch {
    /* Render an unavailable state, never a fabricated empty queue. */
  }
  if (!queue)
    return (
      <section
        className="mt-8 rounded-xl border border-line p-5"
        aria-labelledby="crm-queue-heading"
      >
        <h2
          id="crm-queue-heading"
          className="text-xl font-semibold text-zayan-blue"
        >
          Due work and open sales
        </h2>
        <p role="status" className="mt-3">
          The work queue could not be loaded.{" "}
          <Link href="/admin" className="underline">
            Reload to retry
          </Link>
          .
        </p>
      </section>
    );
  const date = new Intl.DateTimeFormat("en-PK", {
    timeZone: queue.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <section className="mt-8" aria-labelledby="crm-queue-heading">
      <h2
        id="crm-queue-heading"
        className="text-xl font-semibold text-zayan-blue"
      >
        Due work and open sales
      </h2>
      <p className="mt-2 text-sm text-muted">
        Records in your authorized scope. Company time: {queue.timeZone}.
        Showing up to 30 work items or 20 sales records per section; open the
        module for all records.
      </p>
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        {queue.groups
          .filter((group) => group.allowed && group.items.length > 0)
          .map((group) => (
            <article
              key={group.key}
              className="min-w-0 rounded-xl border border-line bg-surface p-5"
            >
              <h3 className="font-semibold text-zayan-blue">{group.label}</h3>
              {!group.allowed ? (
                <p className="mt-3 text-sm text-muted">
                  This section requires its module viewing permission.
                </p>
              ) : (
                <>
                  {group.items.length ? (
                    <ul className="mt-3 space-y-3">
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          className="break-words border-b border-line pb-3"
                        >
                          <Link
                            prefetch={false}
                            href={`/admin/manage/${group.resource}?record=${encodeURIComponent(item.id)}`}
                            className="font-medium underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
                          >
                            {item.title}
                          </Link>
                          {item.owner && (
                            <p className="mt-1 text-sm text-muted">
                              {item.owner}
                            </p>
                          )}
                          <p className="mt-1 text-sm text-muted">
                            {item.at
                              ? date.format(new Date(item.at))
                              : "No due date recorded"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      No matching records in your scope.
                    </p>
                  )}
                  <Link
                    prefetch={false}
                    href={`/admin/manage/${group.resource}`}
                    className="mt-4 inline-block text-sm font-semibold underline"
                  >
                    Open full module
                  </Link>
                </>
              )}
            </article>
          ))}
      </div>
      {queue.groups.some((group) => group.allowed && !group.items.length) && (
        <details className="mt-4 rounded-xl border border-line p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-zayan-blue">
            Queues with no matching work (
            {
              queue.groups.filter(
                (group) => group.allowed && !group.items.length,
              ).length
            }
            )
          </summary>
          <ul className="mt-2 space-y-2">
            {queue.groups
              .filter((group) => group.allowed && !group.items.length)
              .map((group) => (
                <li
                  key={group.key}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>{group.label}: no matching work</span>
                  <Link
                    prefetch={false}
                    href={`/admin/manage/${group.resource}`}
                    className="min-h-11 py-3 underline"
                  >
                    Open {group.label.toLowerCase()}
                  </Link>
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}
