"use client";
import { canonicalMoney } from "@/lib/staff-management";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RecordSummary, RecordResults } from "./RecordSummary";
import { CrmRelatedWork } from "./CrmRelatedWork";
import { moduleCapabilities, moduleHref } from "@/lib/staff-navigation";
import { AgencyMasthead } from "@/components/admin/AgencyMasthead";
import {
  bookingDocumentUrl,
  bookingFieldSection,
} from "@/lib/booking-presentation";
import { workflowsFor, type StaffWorkflow } from "@/lib/staff-workflows";
import {
  clearReceiptRetry,
  hasPendingReceipt,
  receiptRetryKey,
  savedReceiptRetryKey,
} from "@/lib/receipt-retry";
import { useEffect, useRef, useState } from "react";
import {
  formPayload,
  rowLabel,
  staffConflictMessage,
  type ManagementField,
  type ManagementModule,
  type ManagementRow,
} from "@/lib/staff-management";

const control =
  "mt-1 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";
const button =
  "min-h-11 rounded-xl border border-line px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue disabled:cursor-not-allowed disabled:opacity-50";
const api = "/api/v1/management";

async function request(
  path: string,
  method = "GET",
  body?: unknown,
  requestKey?: string,
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(requestKey ? { "Idempotency-Key": requestKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401)
    throw new Error("Your staff session expired. Sign in again.");
  if (response.status === 403)
    throw new Error("You do not have permission for this operation.");
  if (response.status === 404)
    throw new Error(
      "This record is unavailable or outside your authorized scope.",
    );
  if (response.status === 400 && method === "GET")
    throw new Error(
      "Check the selected filters and company-date range, then try again.",
    );
  if (response.status === 409)
    throw new Error(
      staffConflictMessage(await response.json().catch(() => null)),
    );
  if (!response.ok)
    throw new Error(
      method === "GET"
        ? "Records could not be loaded. Please retry."
        : "Save was not confirmed. Check required fields and reload the record before retrying.",
    );
  return response.json();
}

function useCatalog() {
  const [modules, setModules] = useState<ManagementModule[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request(`${api}/modules`)
      .then((data) => {
        if (active) setModules(data);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Workspace unavailable");
      });
    return () => {
      active = false;
    };
  }, []);
  return { modules, error };
}

export function ManagementHub({
  permissions = [],
  isSuperAdmin = false,
}: {
  permissions?: string[];
  isSuperAdmin?: boolean;
}) {
  const { modules, error } = useCatalog();
  const [query, setQuery] = useState("");
  const filtered = modules?.filter((m) =>
    `${m.title} ${m.group}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section>
      <h1 className="text-3xl font-bold text-zayan-blue">Management</h1>
      <p className="mt-2 text-muted">
        Open a module to search records and use the actions permitted for your
        staff account.
      </p>
      <label className="mt-5 block max-w-lg font-medium">
        Find a module
        <input
          type="search"
          className={control}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="mt-5">
          {error}{" "}
          <Link className="underline" href="/admin/login">
            Staff sign in
          </Link>
        </p>
      )}
      {!modules && !error && (
        <p role="status" className="mt-5">
          Loading your modules…
        </p>
      )}
      {Array.from(new Set(filtered?.map((m) => m.group))).map((group) => (
        <section key={group} className="mt-7">
          <h2 className="text-xl font-semibold text-zayan-blue">{group}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered
              ?.filter((m) => m.group === group)
              .map((m) => (
                <Link
                  className="rounded-xl border border-line bg-surface p-4 hover:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue"
                  href={moduleHref(m.key)}
                  key={m.key}
                >
                  <span className="block font-semibold">{m.title}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {moduleCapabilities(m, permissions, isSuperAdmin)}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ))}
      {modules && !filtered?.length && (
        <p role="status" className="mt-5">
          No authorized modules match.
        </p>
      )}
    </section>
  );
}

function ReferenceInput({
  field,
  value,
  disabled,
}: {
  field: ManagementField;
  value: string;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ManagementRow[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(value);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        request(
          `${api}/${["branches", "users"].includes(field.reference || "") ? "options/" : ""}${field.reference}?q=${encodeURIComponent(query)}`,
        )
          .then((data) => {
            if (active) {
              setOptions(data.data);
              setError("");
            }
          })
          .catch(() => {
            if (active)
              setError(
                "Options unavailable. You may keep the current selection or retry searching.",
              );
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, field.reference]);
  return (
    <div>
      <input
        aria-label={`Search ${field.label} options`}
        className={control}
        type="search"
        placeholder="Search available records"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      <select
        id={`field-${field.name}`}
        className={control}
        name={field.name}
        aria-label={field.label}
        required={field.required}
        disabled={disabled}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Select {field.label.toLowerCase()}</option>
        {selected && !options.some((r) => r.id === selected) && (
          <option value={selected}>Current selection ({selected})</option>
        )}
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {rowLabel(row)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted">
        {error || "Up to 20 matches. Search to narrow the selection."}
      </p>
    </div>
  );
}

function Field({
  field,
  row,
  disabled,
  create,
}: {
  field: ManagementField;
  row: ManagementRow | null;
  disabled: boolean;
  create: boolean;
}) {
  const value = row?.[field.name];
  const initial = value == null ? "" : String(value);
  const required = field.required && create;
  const base = {
    className: control,
    name: field.name,
    disabled,
    required,
    defaultValue: initial,
  };
  return (
    <div className="min-w-0">
      <label
        className="block text-sm font-semibold"
        htmlFor={`field-${field.name}`}
      >
        {field.label}
        {field.type === "DateTime" && !field.label.includes("UTC") ? " (UTC)" : ""}
        {required ? " *" : ""}
      </label>
      {field.reference ? (
        <ReferenceInput
          field={{ ...field, required }}
          value={initial}
          disabled={disabled}
        />
      ) : field.type === "Boolean" ? (
        <select
          {...base}
          id={`field-${field.name}`}
          defaultValue={initial || "false"}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      ) : field.options ? (
        <select {...base} id={`field-${field.name}`}>
          <option value="">Select…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {field.optionLabels?.[option] || option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : /notes|description|body|terms|flightInfo/i.test(field.name) ? (
        <textarea
          {...base}
          id={`field-${field.name}`}
          rows={4}
          maxLength={10000}
        />
      ) : (
        <input
          {...base}
          id={`field-${field.name}`}
          type={
            field.type === "DateTime"
              ? "datetime-local"
              : ["Int", "Float", "Decimal"].includes(field.type)
                ? "number"
                : /email/i.test(field.name)
                  ? "email"
                  : "text"
          }
          min={
            field.min ??
            (["Int", "Float", "Decimal"].includes(field.type) ? 0 : undefined)
          }
          step={field.type === "Int" ? "1" : "any"}
          maxLength={300}
          defaultValue={
            field.type === "DateTime" ? initial.slice(0, 16) : initial
          }
        />
      )}
    </div>
  );
}

function BookingFields({
  fields,
  row,
  disabled,
  create,
}: {
  fields: ManagementField[];
  row: ManagementRow | null;
  disabled: boolean;
  create: boolean;
}) {
  const sections = [
    ...new Set(fields.map((field) => bookingFieldSection(field.name))),
  ];
  return (
    <div className="mt-5 space-y-5">
      {sections.map((section) => (
        <fieldset
          key={section}
          className="rounded-xl border border-line bg-white p-4"
          disabled={disabled}
        >
          <legend className="px-2 text-sm font-bold text-zayan-blue">
            {section}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields
              .filter((field) => bookingFieldSection(field.name) === section)
              .map((field) => (
                <Field
                  key={`${row?.id || "new"}-${field.name}`}
                  field={field}
                  row={row}
                  disabled={disabled}
                  create={create}
                />
              ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

type StaffAccess = {
  target: {
    id: string;
    fullName: string;
    status: string;
    defaultBranchId: string | null;
    updatedAt: string;
    roles: { roleId: string }[];
    branches: { branchId: string }[];
  };
  roles: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  statuses: string[];
};
function StaffAccessEditor({
  id,
  close,
  saved,
}: {
  id: string;
  close: () => void;
  saved: () => void;
}) {
  const [access, setAccess] = useState<StaffAccess | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request(`${api}/users/${id}/access`)
      .then((data) => {
        if (active) setAccess(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function save(form: FormData) {
    if (!access || busy || form.get("confirm") !== "yes") return;
    setBusy(true);
    setError("");
    try {
      await request(`${api}/users/${id}/access`, "POST", {
        roleIds: form.getAll("roleIds"),
        branchIds: form.getAll("branchIds"),
        defaultBranchId: form.get("defaultBranchId") || null,
        status: form.get("status"),
        version: access.target.updatedAt,
      });
      saved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Access update was not confirmed. Reload before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      action={save}
      className="mt-5 rounded-xl border border-line bg-surface p-5"
    >
      <h2 className="text-xl font-semibold">Staff access</h2>
      <p className="mt-2 text-sm">
        Access changes revoke this staff member’s existing sessions. They must
        sign in again. A default branch must be included in the selected
        branches.
      </p>
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
      {!access && !error && <p role="status">Loading access settings…</p>}
      {access && (
        <>
          <fieldset className="mt-4" disabled={busy}>
            <legend className="font-semibold">Roles</legend>
            {access.roles.map((r) => (
              <label key={r.id} className="mt-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  name="roleIds"
                  value={r.id}
                  defaultChecked={access.target.roles.some(
                    (x) => x.roleId === r.id,
                  )}
                />
                <span>{r.name}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="mt-4" disabled={busy}>
            <legend className="font-semibold">Branches</legend>
            {access.branches.map((b) => (
              <label key={b.id} className="mt-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  name="branchIds"
                  value={b.id}
                  defaultChecked={access.target.branches.some(
                    (x) => x.branchId === b.id,
                  )}
                />
                <span>{b.name}</span>
              </label>
            ))}
          </fieldset>
          <label className="mt-4 block font-semibold">
            Default branch
            <select
              className={control}
              name="defaultBranchId"
              defaultValue={access.target.defaultBranchId || ""}
              disabled={busy}
            >
              <option value="">No default branch</option>
              {access.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block font-semibold">
            Account status
            <select
              className={control}
              name="status"
              defaultValue={access.target.status}
              disabled={busy}
            >
              {access.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              required
              disabled={busy}
            />
            <span>
              I authorize these role, branch and account-access changes.
            </span>
          </label>
          <button className={`${button} mt-4`} disabled={busy}>
            {busy ? "Saving…" : "Save access changes"}
          </button>
        </>
      )}
      <button
        className={`${button} ml-3 mt-4`}
        type="button"
        disabled={busy}
        onClick={close}
      >
        Cancel
      </button>
    </form>
  );
}

function NewStaffForm({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(
        `${api}/users/create-account`,
        "POST",
        Object.fromEntries(
          ["fullName", "username", "email", "password"].map((k) => [
            k,
            form.get(k),
          ]),
        ),
      );
      saved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Account creation was not confirmed. Check the staff list before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      action={save}
      className="mt-5 rounded-xl border border-line bg-surface p-5"
    >
      <h2 className="text-xl font-semibold">Create staff account</h2>
      <p className="mt-2 text-sm">
        The new account starts inactive with no roles. Configure its access and
        activate it separately.
      </p>
      {error && (
        <p role="alert" className="mt-3">
          {error}
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { name: "fullName", label: "Full name", type: "text" },
          { name: "username", label: "Username", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "password", label: "Initial password", type: "password" },
        ].map((f) => (
          <label key={f.name} className="font-semibold">
            {f.label}
            <input
              className={control}
              name={f.name}
              type={f.type}
              required
              disabled={busy}
              autoComplete={f.name === "password" ? "new-password" : "off"}
              minLength={f.name === "password" ? 10 : undefined}
              maxLength={f.name === "password" ? 72 : 254}
              pattern={f.name === "username" ? "[a-z0-9._-]{3,32}" : undefined}
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        Username: 3–32 lowercase letters, numbers, dots, underscores or hyphens.
        Password: at least 10 characters and at most 72 UTF-8 bytes.
      </p>
      <div className="mt-4 flex gap-3">
        <button className={button} disabled={busy}>
          Create inactive account
        </button>
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ManagementWorkspace({
  resource,
  staffUsername,
  canAssign,
  permissions,
  isSuperAdmin,
  initialId,
  initialLeadId,
}: {
  resource: string;
  staffUsername: string;
  canAssign: boolean;
  permissions: string[];
  isSuperAdmin: boolean;
  initialId?: string;
  initialLeadId?: string;
}) {
  const { modules, error: catalogError } = useCatalog();
  const contract = modules?.find((m) => m.key === resource);
  const router = useRouter(),
    searchParams = useSearchParams();
  const filterKeys = [
    "q",
    "status",
    "assignedUserId",
    "branchId",
    "from",
    "to",
    "sort",
    "page",
  ];
  const listParameters = new URLSearchParams();
  for (const key of filterKeys) {
    const value = searchParams.get(key);
    if (value) listParameters.set(key, value);
  }
  const filterQuery = listParameters.toString();
  const page = Number(searchParams.get("page") || "1");
  function listUrl(changes: Record<string, string> = {}) {
    const params = new URLSearchParams(filterQuery);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/admin/manage/${resource}${params.size ? "?" + params.toString() : ""}`;
  }
  function backToList() {
    setRow(null);
    setWorkflow(null);
    setMessage("");
    router.push(listUrl());
  }

  const [list, setList] = useState<{
    data: ManagementRow[];
    total: number;
  } | null>(null);
  const linkedLead =
    !initialId && initialLeadId && ["follow-ups", "tasks"].includes(resource)
      ? initialLeadId
      : undefined;
  const [row, setRow] = useState<ManagementRow | null>(() =>
    linkedLead ? { id: "", version: null, leadId: linkedLead } : null,
  );
  const [editing, setEditing] = useState(Boolean(linkedLead));
  const [creating, setCreating] = useState(Boolean(linkedLead));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [assignees, setAssignees] = useState<
    { id: string; fullName: string }[]
  >([]);
  const [assigning, setAssigning] = useState(false);
  const [workflow, setWorkflow] = useState<StaffWorkflow | null>(null);
  const supplierPayment = resource === "payments";
  const settlementResource = supplierPayment ? "payments" : "receipts";
  const retryIdentity = supplierPayment ? `supplier-payment:${staffUsername}` : staffUsername;
  const settlementLabel = supplierPayment ? "supplier payment" : "receipt";
  const [pendingReceipt, setPendingReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{
    id: string;
    receiptNo?: string;
    paymentNo?: string;
    amount: string;
    method: string;
  } | null>(null);
  const workflowPending = useRef(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [staffCreate, setStaffCreate] = useState(false);
  useEffect(() => {
    if (!contract) return;
    let active = true;

    request(`${api}/${resource}?${filterQuery}&presentation=true`)
      .then((data) => {
        if (active) setList(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [contract, resource, filterQuery, revision]);
  useEffect(() => {
    if (!initialId) return;
    let active = true;
    request(`${api}/${resource}/${initialId}/summary`)
      .then((data) => {
        if (active) setRow(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [initialId, resource]);
  async function open(id: string) {
    router.push(listUrl({ record: id }));
  }
  async function save(form: FormData) {
    if (!contract || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = formPayload(contract.writeFields, form, creating);
      const saved = await request(
        `${api}/${resource}${creating ? "" : `/${row!.id}`}`,
        creating ? "POST" : "PATCH",
        { data, ...(creating ? {} : { version: row!.version }) },
      );
      setRow(await request(`${api}/${resource}/${saved.id}/summary`));
      router.replace(listUrl({ record: saved.id }));
      setEditing(false);
      setCreating(false);
      setRevision((r) => r + 1);
      setMessage("Changes saved.");
    } catch (e) {
      setError(
        e instanceof Error &&
          e.name !== "TimeoutError" &&
          e.name !== "TypeError"
          ? e.message
          : "Save outcome is uncertain. Reload and check the record before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function assignment(form: FormData) {
    if (!row || busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`${api}/leads/${row.id}/assign`, "POST", {
        assignedUserId: form.get("assignedUserId") || null,
        version: row.version,
      });
      setRow(await request(`${api}/${resource}/${row.id}/summary`));
      setAssigning(false);
      setMessage("Assignment saved.");
      setRevision((r) => r + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Assignment outcome is uncertain. Reload before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function chooseWorkflow(action: StaffWorkflow) {
    setMessage("");
    setError("");
    if (isSuperAdmin) {
      try {
        setPendingReceipt(hasPendingReceipt(localStorage, retryIdentity));
        setReceiptPreview(null);
        const key = savedReceiptRetryKey(localStorage, retryIdentity);
        if (key) {
          try {
            setReceiptPreview(
              await request(
                `/api/v1/finance/${settlementResource}/submission/${encodeURIComponent(key)}`,
              ),
            );
          } catch {
            /* Keep the original key: a missing response is not proof of no payment. */
          }
        }
      } catch {
        setError(
          "Browser storage is unavailable. Receipt submissions need reload-safe retry storage.",
        );
        return;
      }
    }
    if (supplierPayment) {
      try {
        const pending = await request("/api/v1/finance/payments/pending");
        if (pending.length) { setReceiptPreview(pending[0]); setPendingReceipt(true); }
      } catch { setError("Supplier payment recovery is unavailable. Do not start a payment."); return; }
    }
    if (
      ["checkin", "checkout", "allocate", "transfer"].includes(action.key) &&
      row
    ) {
      setBusy(true);
      try {
        const rooms: {
          id: string;
          roomNumber: string | null;
          status: string;
        }[] = await request(`${api}/hotel-bookings/${row.id}/rooms`);
        if (!rooms.length)
          throw new Error(
            "This reservation has no available stay-room records.",
          );
        setWorkflow({
          ...action,
          fields: action.fields.map((f) =>
            ["roomId", "fromRoomId"].includes(f.name)
              ? {
                  ...f,
                  options: rooms.map((r) => r.id),
                  optionLabels: Object.fromEntries(
                    rooms.map((r, i) => [
                      r.id,
                      `${r.roomNumber || `Room ${i + 1}`} · ${r.status}`,
                    ]),
                  ),
                }
              : f,
          ),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Rooms unavailable");
      } finally {
        setBusy(false);
      }
    } else setWorkflow(action);
  }
  async function runWorkflow(form: FormData) {
    if (
      !workflow ||
      busy ||
      workflowPending.current ||
      form.get("confirm") !== "yes"
    )
      return;
    workflowPending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = formPayload(workflow.fields, form, true);
      for (const field of workflow.fields) {
        if (
          ["Int", "Float", "Decimal"].includes(field.type) &&
          data[field.name] !== undefined
        ) {
          if (field.type === "Decimal") {
            data[field.name] = canonicalMoney(data[field.name]);
            if (!["receipts", "payments", "expenses"].includes(resource) && BigInt(String(data[field.name]).replace(".", "")) > BigInt("100000000000000")) throw new Error("This service supports amounts up to 1,000,000,000,000.00. Larger values require review.");
            continue;
          }
          const n = Number(data[field.name]);
          if (
            !Number.isFinite(n) ||
            n < (field.min ?? 0) ||
            (field.type === "Int" && !Number.isInteger(n))
          )
            throw new Error(
              `Enter a valid ${field.label.toLowerCase()} (minimum ${field.min ?? 0}${field.type === "Int" ? ", whole numbers only" : ""}).`,
            );
          data[field.name] = n;
        }
      }
      for (const field of workflow.fields)
        if (field.type === "DateTime" && typeof data[field.name] === "string")
          data[field.name] = new Date(`${data[field.name]}Z`).toISOString();
      if (workflow.key === "create-reservation") {
        const count = Number(data.roomCount);
        const occupancy = Number(data.occupancy);
        if (
          !Number.isInteger(count) ||
          count < 1 ||
          count > 20 ||
          !Number.isInteger(occupancy) ||
          occupancy < 1 ||
          occupancy > 20
        )
          throw new Error("Select 1–20 rooms and 1–20 occupants per room.");
        if (new Date(String(data.checkOut)) <= new Date(String(data.checkIn)))
          throw new Error("Check-out must be after check-in.");
        if (data.passengerId && count !== 1)
          throw new Error(
            "Select one room to use the quick guest allocation field.",
          );
        data.segments = [
          {
            hotelId: data.hotelId,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            rooms: Array.from({ length: count }, () => ({
              passengerIds: data.passengerId ? [data.passengerId] : [],
              roomTypeId: data.roomTypeId,
              occupancy,
              sellingPrice: data.sellingPrice,
              supplierCost: data.supplierCost,
            })),
          },
        ];
        for (const key of [
          "roomCount",
          "occupancy",
          "sellingPrice",
          "supplierCost",
          "roomTypeId",
        ])
          delete data[key];
      }
      if (workflow.version && row) data.version = row.version;
      let requestKey: string | undefined;
      if (
        ["receipts", "payments"].includes(resource) ||
        Number(data.paid ?? data.paidAmount ?? 0) > 0
      ) {
        if (!navigator.locks)
          throw new Error(
            "This browser cannot safely coordinate receipt retries across tabs.",
          );
        requestKey = await navigator.locks.request(
          `zat:settlement-key:${retryIdentity}`,
          () =>
            receiptRetryKey(
              localStorage,
              retryIdentity,
              ["receipts", "payments"].includes(resource)
                ? data
                : { ...data, paymentWorkflowPath: workflow.path },
            ),
        );
        setPendingReceipt(true);
      }
      const result = await request(
        workflow.path.replace(":id", encodeURIComponent(row?.id || "")),
        "POST",
        data,
        requestKey,
      );
      if (requestKey)
        setReceiptPreview(
          ["receipts", "payments"].includes(resource)
            ? result
            : await request(
                `/api/v1/finance/${settlementResource}/submission/${encodeURIComponent(requestKey)}`,
              ),
        );
      const selectedId = row?.id;
      setWorkflow(null);
      setRevision((r) => r + 1);
      if (selectedId)
        setRow(await request(`${api}/${resource}/${selectedId}/summary`));
      setMessage("Operation completed. Review the refreshed record.");
    } catch (e) {
      setError(
        e instanceof Error && !["TypeError", "TimeoutError"].includes(e.name)
          ? e.message
          : "Operation outcome is uncertain. Review the record and accounting history before retrying.",
      );
    } finally {
      workflowPending.current = false;
      setBusy(false);
    }
  }
  async function reviewSavedReceipt(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(
        `/api/v1/finance/${settlementResource}/${encodeURIComponent(id)}/review`,
        "POST",
        { reviewed: true },
      );
      const key = savedReceiptRetryKey(localStorage, retryIdentity);
      if (key) {
        const saved = await request(
          `/api/v1/finance/${settlementResource}/submission/${encodeURIComponent(key)}`,
        );
        if (saved.id === id) clearReceiptRetry(localStorage, retryIdentity);
      }
      setPendingReceipt(hasPendingReceipt(localStorage, retryIdentity));
      setReceiptPreview(null);
      setWorkflow(null);
      setMessage(
        `Saved ${settlementLabel} reviewed. You may explicitly start a new payment.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Receipt review was not confirmed. Retry the original submission.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (catalogError || (modules && !contract))
    return (
      <section role="alert">
        <h1 className="text-2xl font-bold">Module unavailable</h1>
        <p>
          {catalogError || "Your account does not have access to this module."}
        </p>
        <Link href="/admin/manage" className="underline">
          Back to management
        </Link>
      </section>
    );
  if (!contract) return <p role="status">Loading workspace…</p>;
  if (linkedLead && !contract.canCreate)
    return (
      <p role="alert">
        You do not have permission to create linked work in this module.
      </p>
    );
  return (
    <section>
      {!["leads", "customers", "tasks", "follow-ups", "quotations"].includes(
        resource,
      ) && <AgencyMasthead />}
      <Link href="/admin/manage" className="text-sm underline">
        All management modules
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-zayan-blue">{contract.title}</h1>
        {contract.canCreate && !editing && (
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              setRow(null);
              setWorkflow(null);
              setCreating(true);
              setEditing(true);
              setMessage("");
              setError("");
            }}
          >
            New record
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-300 p-4">
          {error}{" "}
          <button
            className="underline"
            onClick={() => {
              if (row) void open(row.id);
              setRevision((r) => r + 1);
            }}
            disabled={busy}
          >
            Reload
          </button>
        </p>
      )}
      {row &&
        !editing &&
        (isSuperAdmin || permissions.includes("document.view")) &&
        bookingDocumentUrl(resource, row.id, false) && (
          <div className="mt-4 rounded-xl border border-line bg-surface p-4">
            <h2 className="font-semibold text-zayan-blue">Agency document</h2>
            <p className="mt-1 text-sm text-muted">
              Print the saved record. Access is checked again by the document
              service.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                className={button}
                href={bookingDocumentUrl(resource, row.id, true)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {resource === "visa-applications"
                  ? "Application PDF"
                  : "PDF with prices"}
              </a>
              {resource !== "visa-applications" && (
                <a
                  className={button}
                  href={bookingDocumentUrl(resource, row.id, false)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF without prices
                </a>
              )}
            </div>
          </div>
        )}
      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-green-300 p-4"
        >
          {message}
        </p>
      )}
      {pendingReceipt && (
        <div className="mt-4 rounded-xl border border-amber-300 p-4">
          <p>
            A prior {settlementLabel} needs review. Retry its original details safely, or review the saved record before starting another payment. Ledger review does not confirm a bank transfer.
          </p>
          {receiptPreview && (
            <>
              <p className="mt-2">
                Saved {settlementLabel}: {receiptPreview.paymentNo || receiptPreview.receiptNo} ·{" "}
                {canonicalMoney(receiptPreview.amount)} ·{" "}
                {receiptPreview.method}
              </p>
              <Link className="mt-2 block underline" href={`/admin/manage/${settlementResource}?record=${encodeURIComponent(receiptPreview.id)}`}>Open saved {settlementLabel} details before review</Link>
              <button
                type="button"
                className={`${button} mt-3`}
                disabled={busy}
                onClick={() => void reviewSavedReceipt(receiptPreview.id)}
              >
                I reviewed this saved {settlementLabel}; allow a new payment
              </button>
            </>
          )}
          <Link className="mt-3 block underline" href={`/admin/manage/${settlementResource}`}>
            View {settlementLabel} history
          </Link>
        </div>
      )}
      {["receipts", "payments"].includes(resource) && row && isSuperAdmin && (
        <button
          type="button"
          className={`${button} mt-4`}
          disabled={busy}
          onClick={() => void reviewSavedReceipt(row.id)}
        >
          I reviewed this saved {settlementLabel}; allow a new payment
        </button>
      )}
      {resource === "users" && isSuperAdmin && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={button}
            disabled={busy}
            onClick={() => {
              setRow(null);
              setStaffCreate(true);
              setAccessOpen(false);
            }}
          >
            New staff account
          </button>
          {row && (
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setAccessOpen(true);
                setStaffCreate(false);
                setWorkflow(null);
              }}
            >
              Manage access
            </button>
          )}
        </div>
      )}
      {staffCreate && (
        <NewStaffForm
          close={() => setStaffCreate(false)}
          saved={() => {
            setStaffCreate(false);
            setRevision((r) => r + 1);
            setMessage(
              "Inactive staff account created. Open its record to assign roles, branches and activate access.",
            );
          }}
        />
      )}
      {accessOpen && row && (
        <StaffAccessEditor
          key={row.id}
          id={row.id}
          close={() => setAccessOpen(false)}
          saved={() => {
            setAccessOpen(false);
            void open(row.id);
            setMessage(
              "Access saved. Existing sessions for this account were revoked.",
            );
          }}
        />
      )}
      {!editing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {workflowsFor(resource, !!row, permissions, isSuperAdmin).map(
            (action) => (
              <button
                key={action.key}
                className={button}
                disabled={busy}
                onClick={() => void chooseWorkflow(action)}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
      {workflow && (
        <form
          key={`${workflow.key}-${row?.id || "new"}`}
          action={runWorkflow}
          className="mt-5 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="text-xl font-semibold">{workflow.label}</h2>
          {row && (
            <p className="mt-2 font-medium">Selected record: {rowLabel(row)}</p>
          )}
          {workflow.caution && (
            <p className="mt-3 rounded-lg border border-amber-300 p-3 text-sm">
              {workflow.caution}
            </p>
          )}
          <BookingFields
            fields={workflow.fields}
            row={null}
            disabled={busy}
            create
          />
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              name="confirm"
              value="yes"
              disabled={busy}
              className="mt-1"
            />
            <span>
              I reviewed this action and the selected record and authorize this
              change.
            </span>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={`${button} bg-zayan-blue text-white`}
              disabled={busy}
            >
              Confirm {workflow.label.toLowerCase()}
            </button>
            <button
              className={button}
              type="button"
              disabled={busy}
              onClick={() => setWorkflow(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {editing ? (
        <form
          action={save}
          className="mt-6 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="text-xl font-semibold">
            {creating ? "Create record" : `Edit ${rowLabel(row!)}`}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Review changes before saving. Times are entered in UTC.
          </p>
          <BookingFields
            fields={contract.writeFields}
            row={row}
            disabled={busy}
            create={creating}
          />
          <div className="mt-5 flex gap-3">
            <button
              className={`${button} bg-zayan-blue text-white`}
              disabled={busy}
              type="submit"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setCreating(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : row ? (
        <div className="mt-6">
          <div className="flex flex-wrap gap-3">
            <button className={button} disabled={busy} onClick={backToList}>
              Back to list
            </button>
            {contract.canEdit && (
              <button
                className={button}
                disabled={busy}
                onClick={() => {
                  setWorkflow(null);
                  setEditing(true);
                }}
              >
                Edit record
              </button>
            )}
            {resource === "leads" &&
              [
                {
                  permission: "followup",
                  resource: "follow-ups",
                  label: "Schedule follow-up",
                },
                {
                  permission: "task",
                  resource: "tasks",
                  label: "Add lead task",
                },
              ]
                .filter(
                  (action) =>
                    isSuperAdmin ||
                    (permissions.includes(`${action.permission}.view`) &&
                      permissions.includes(`${action.permission}.create`)),
                )
                .map((action) => (
                  <Link
                    prefetch={false}
                    key={action.resource}
                    className={button}
                    href={`/admin/manage/${action.resource}?lead=${encodeURIComponent(row.id)}`}
                  >
                    {action.label}
                  </Link>
                ))}
            {resource === "leads" && canAssign && (
              <button
                className={button}
                disabled={busy}
                onClick={async () => {
                  try {
                    const data = await request(
                      `${api}/leads/${row.id}/assignees`,
                    );
                    setAssignees(data);
                    setAssigning(true);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Assignees unavailable",
                    );
                  }
                }}
              >
                Assign staff
              </button>
            )}
          </div>
          {assigning && (
            <form
              className="mt-4 rounded-xl border border-line p-4"
              action={assignment}
            >
              <label className="font-semibold" htmlFor="lead-assignee">
                Assigned staff
              </label>
              <select
                id="lead-assignee"
                name="assignedUserId"
                className={control}
                defaultValue={String(row.assignedUserId || "")}
                disabled={busy}
              >
                <option value="">Unassigned</option>
                {Boolean(row.assignedUserId) &&
                  !assignees.some((a) => a.id === row.assignedUserId) && (
                    <option value={String(row.assignedUserId)}>
                      Current assignment (unavailable)
                    </option>
                  )}
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-muted">
                Only active staff in this lead’s branch can be selected.
              </p>
              <button className={`${button} mt-3`} disabled={busy}>
                Save assignment
              </button>
            </form>
          )}
          <h2 className="mt-5 text-xl font-semibold">{rowLabel(row)}</h2>
          <RecordSummary fields={contract.fields} row={row} />
          {["leads", "customers"].includes(resource) && (
            <CrmRelatedWork
              key={`${row.id}:${revision}`}
              resource={resource}
              id={row.id}
              revision={revision}
              timeZone={row.presentation?.timeZone || "Asia/Karachi"}
              permissions={permissions}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </div>
      ) : (
        <>
          <form
            key={filterQuery}
            className="mt-5 grid gap-3 rounded-xl border border-line bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget),
                params: Record<string, string> = { page: "1" };
              for (const key of filterKeys.filter((key) => key !== "page"))
                params[key] = String(form.get(key) || "");
              setList(null);
              setError("");
              router.push(listUrl(params));
            }}
          >
            <label className="min-w-0 font-medium">
              Search records
              <input
                name="q"
                className={control}
                type="search"
                maxLength={100}
                defaultValue={searchParams.get("q") || ""}
              />
            </label>
            {[
              "leads",
              "customers",
              "tasks",
              "follow-ups",
              "quotations",
              "complaints",
            ].includes(resource) && (
              <>
                {contract.fields.find(
                  (field) => field.name === "status" && field.options,
                ) && (
                  <label className="font-medium">
                    Status
                    <select
                      aria-label="Status"
                      className={control}
                      name="status"
                      defaultValue={searchParams.get("status") || ""}
                    >
                      <option value="">All statuses</option>
                      {contract.fields
                        .find((field) => field.name === "status")!
                        .options!.map((value) => (
                          <option key={value} value={value}>
                            {value.replaceAll("_", " ")}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {contract.fields
                  .filter((field) =>
                    ["assignedUserId", "branchId"].includes(field.name),
                  )
                  .map((field) => (
                    <Field
                      key={field.name}
                      field={{
                        ...field,
                        required: false,
                        nullable: true,
                        label:
                          field.name === "branchId"
                            ? "Branch"
                            : "Assigned staff",
                      }}
                      row={{
                        id: "",
                        version: null,
                        [field.name]: searchParams.get(field.name) || "",
                      }}
                      create={false}
                      disabled={busy}
                    />
                  ))}
                <label className="font-medium">
                  Created from (company date)
                  <input
                    className={control}
                    type="date"
                    name="from"
                    defaultValue={searchParams.get("from") || ""}
                  />
                </label>
                <label className="font-medium">
                  Created through (company date)
                  <input
                    className={control}
                    type="date"
                    name="to"
                    defaultValue={searchParams.get("to") || ""}
                  />
                </label>
                <label className="font-medium">
                  Sort records
                  <select
                    aria-label="Sort records"
                    className={control}
                    name="sort"
                    defaultValue={searchParams.get("sort") || "newest"}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name or reference</option>
                    <option value="updated">Recently updated</option>
                  </select>
                </label>
              </>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <button className={button} disabled={busy}>
                Apply filters
              </button>
              <Link
                className={`${button} inline-flex items-center`}
                href={`/admin/manage/${resource}`}
              >
                Reset filters
              </Link>
            </div>
          </form>
          {!list && !error && (
            <p role="status" className="mt-5">
              Loading authorized records…
            </p>
          )}
          {list && (
            <>
              <p className="mt-4 text-sm text-muted">
                {list.total} records · Page {page} of{" "}
                {Math.max(1, Math.ceil(list.total / 20))}
              </p>
              {!list.data.length && (
                <p role="status" className="mt-4">
                  No records found.
                </p>
              )}
              <RecordResults
                resource={resource}
                fields={contract.fields}
                rows={list.data}
                onOpen={(id) => void open(id)}
                busy={busy}
              />
              <nav aria-label="Record pagination" className="mt-5 flex gap-3">
                <button
                  className={button}
                  disabled={busy || page <= 1}
                  onClick={() => {
                    setList(null);
                    router.push(listUrl({ page: String(page - 1) }));
                  }}
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={busy || page * 20 >= list.total}
                  onClick={() => {
                    setList(null);
                    router.push(listUrl({ page: String(page + 1) }));
                  }}
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </>
      )}
    </section>
  );
}
