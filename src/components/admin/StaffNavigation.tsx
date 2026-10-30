"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { StaffLogoutButton } from "@/components/admin/StaffSessionForm";
import { moduleHref, navigationGroup } from "@/lib/staff-navigation";
import type { ManagementModule } from "@/lib/staff-management";
type ModuleLink = Pick<ManagementModule, "key" | "title" | "group">;
export function StaffNavigation({
  fullName,
  modules,
  unavailable = false,
}: {
  fullName: string;
  modules: ModuleLink[];
  unavailable?: boolean;
}) {
  const pathname = usePathname(),
    [open, setOpen] = useState(false),
    trigger = useRef<HTMLButtonElement>(null);
  const selected = modules.find(
    (module) =>
      pathname === moduleHref(module.key) ||
      pathname.startsWith(moduleHref(module.key) + "/"),
  );
  const groups = [
    ...new Set(modules.map((module) => navigationGroup(module.group))),
  ];
  const linkStyle =
    "block min-h-11 rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange";
  function close() {
    setOpen(false);
  }
  return (
    <aside
      className="min-w-0 self-start rounded-2xl border border-line bg-surface lg:sticky lg:top-5"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          close();
          trigger.current?.focus();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line p-4 lg:flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Staff workspace
          </p>
          <p className="mt-1 break-words font-semibold text-zayan-blue">
            {fullName}
          </p>
        </div>
        <StaffLogoutButton />
      </div>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="staff-primary-navigation"
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold text-zayan-blue lg:hidden"
      >
        {open ? "Close navigation" : "Open navigation"}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav
        id="staff-primary-navigation"
        aria-label="Staff workspace"
        className={`${open ? "block" : "hidden"} p-3 lg:block lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto`}
      >
        <Link
          prefetch={false}
          onClick={close}
          href="/admin"
          aria-current={pathname === "/admin" ? "page" : undefined}
          className={`${linkStyle} ${pathname === "/admin" ? "bg-zayan-blue text-white" : "hover:bg-slate-100"}`}
        >
          Dashboard
        </Link>
        <Link
          prefetch={false}
          onClick={close}
          href="/admin/manage"
          aria-current={pathname === "/admin/manage" ? "page" : undefined}
          className={`${linkStyle} ${pathname === "/admin/manage" ? "bg-zayan-blue text-white" : "hover:bg-slate-100"}`}
        >
          All modules
        </Link>
        {unavailable && (
          <p role="status" className="p-3 text-sm text-muted">
            Module navigation is unavailable. Reload to retry.
          </p>
        )}
        {groups.map((group) => (
          <details
            key={group}
            open={
              selected
                ? navigationGroup(selected.group) === group
                : group === "CRM"
            }
            className="mt-3 border-t border-line pt-2"
          >
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-bold text-zayan-blue">
              {group}
            </summary>
            <ul className="space-y-1">
              {modules
                .filter((module) => navigationGroup(module.group) === group)
                .map((module) => (
                  <li key={module.key}>
                    <Link
                      prefetch={false}
                      onClick={close}
                      href={moduleHref(module.key)}
                      aria-current={
                        selected?.key === module.key ? "page" : undefined
                      }
                      className={`${linkStyle} ${selected?.key === module.key ? "bg-zayan-blue text-white" : "hover:bg-slate-100"}`}
                    >
                      {module.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </details>
        ))}
      </nav>
    </aside>
  );
}
export function StaffBreadcrumbs({ modules }: { modules: ModuleLink[] }) {
  const pathname = usePathname();
  const selected = modules.find(
    (module) =>
      pathname === moduleHref(module.key) ||
      pathname.startsWith(moduleHref(module.key) + "/"),
  );
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/admin" className="underline">
            Workspace
          </Link>
        </li>
        {selected ? (
          <>
            <li aria-hidden="true">/</li>
            <li>{navigationGroup(selected.group)}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-zayan-blue">
              {selected.title}
            </li>
          </>
        ) : (
          <>
            <li aria-hidden="true">/</li>
            <li aria-current="page">
              {pathname === "/admin" ? "Dashboard" : "All modules"}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
