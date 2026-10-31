import Link from "next/link";
import { moduleHref } from "@/lib/staff-navigation";
import {
  formatRecordValue,
  recordSection,
  type ManagementField,
  type ManagementRow,
} from "@/lib/staff-management";
function Value({ field, row }: { field: ManagementField; row: ManagementRow }) {
  const reference = row.presentation?.references[field.name];
  const text = formatRecordValue(field, row);
  return reference?.link && reference.resource && reference.id ? (
    <Link
      prefetch={false}
      className="underline"
      href={`${moduleHref(reference.resource)}?record=${encodeURIComponent(reference.id)}`}
    >
      {text}
    </Link>
  ) : (
    <>{text}</>
  );
}
export function RecordSummary({
  fields,
  row,
}: {
  fields: ManagementField[];
  row: ManagementRow;
}) {
  const visible = fields.filter(
    (field) =>
      row[field.name] !== null &&
      row[field.name] !== undefined &&
      row[field.name] !== "",
  );
  const groups = [...new Set(visible.map(recordSection))];
  return (
    <>
      <p className="mt-2 text-xs text-muted">
        Dates shown in {row.presentation?.timeZone || "company time"}. Amounts
        use the record currency where recorded.
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group}
            className="min-w-0 rounded-xl border border-line bg-surface p-4"
          >
            <h3 className="font-semibold text-zayan-blue">{group}</h3>
            <dl className="mt-3 divide-y divide-line">
              {visible
                .filter((field) => recordSection(field) === group)
                .map((field) => (
                  <div
                    key={field.name}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"
                  >
                    <dt className="text-sm text-muted">
                      {field.label.replace(/ id$/i, "")}
                    </dt>
                    <dd className="min-w-0 break-words whitespace-pre-wrap text-sm font-medium">
                      <Value field={field} row={row} />
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>
      <details className="mt-5 rounded-xl border border-line p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
          Technical references
        </summary>
        <dl className="space-y-2 text-xs">
          <div>
            <dt>Record ID</dt>
            <dd className="break-all">{row.id}</dd>
          </div>
          {fields
            .filter((field) => field.reference && row[field.name])
            .map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd className="break-all">{String(row[field.name])}</dd>
              </div>
            ))}
        </dl>
      </details>
    </>
  );
}
export function RecordResults({
  fields,
  resource,
  rows,
  onOpen,
  busy,
}: {
  fields: ManagementField[];
  resource: string;
  rows: ManagementRow[];
  onOpen: (id: string) => void;
  busy: boolean;
}) {
  const businessColumns: Record<string, string[]> = {
    payments: ["paymentNo", "supplierId", "date", "amount", "method", "branchId"],
    leads: ["fullName", "leadNumber", "mobile", "status", "assignedUserId", "nextFollowUpAt"],
    customers: ["fullName", "customerNumber", "phone", "email", "branchId"],
    quotations: ["quotationNumber", "customerId", "leadId", "status", "net", "expiresAt"],
    tasks: ["title", "status", "priority", "assignedUserId", "dueDate"],
    "follow-ups": ["subject", "status", "priority", "assignedUserId", "dueAt"],
    complaints: ["complaintNumber", "subject", "customerId", "status", "priority", "assignedUserId"],
  };
  const names = businessColumns[resource] || ["bookingNumber", "ticketNumber", "receiptNo", "entryNumber", "fullName", "name", "title", "subject", "status", "customerId", "passengerId", "hotelId", "branchId", "net", "amount", "dueAt", "dueDate"];
  const columns = names
    .map((name) => fields.find((field) => field.name === name))
    .filter((field): field is ManagementField => !!field)
    .slice(0, 6);
  if (!columns.length) columns.push(...fields.slice(0, 4));
  return (
    <>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Authorized filtered records</caption>
          <thead className="bg-slate-50">
            <tr>
              {columns.map((field) => (
                <th
                  key={field.name}
                  scope="col"
                  className="px-4 py-3 font-semibold"
                >
                  {field.label.replace(/ id$/i, "")}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((field) => (
                  <td
                    key={field.name}
                    className="max-w-xs break-words px-4 py-3"
                  >
                    {formatRecordValue(field, row)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <button
                    disabled={busy}
                    className="min-h-11 rounded-lg border border-line px-3 py-2 font-semibold"
                    onClick={() => onOpen(row.id)}
                  >
                    Open record
                    <span className="sr-only">
                      {" "}
                      {String(
                        row.fullName || row.name || row.bookingNumber || row.id,
                      )}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 grid gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <dl className="space-y-2">
              {columns.map((field) => (
                <div key={field.name}>
                  <dt className="text-xs text-muted">
                    {field.label.replace(/ id$/i, "")}
                  </dt>
                  <dd className="break-words text-sm font-medium">
                    {formatRecordValue(field, row)}
                  </dd>
                </div>
              ))}
            </dl>
            <button
              disabled={busy}
              className="mt-3 min-h-11 rounded-lg border border-line px-4 py-2 font-semibold"
              onClick={() => onOpen(row.id)}
            >
              Open record
              <span className="sr-only">
                {" "}
                {String(
                  row.fullName || row.name || row.bookingNumber || row.id,
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
