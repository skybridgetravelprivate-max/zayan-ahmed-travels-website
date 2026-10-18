export type StaffLeadSummary = {
  id: string;
  leadNumber: string;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  status: string;
  source: string;
  priority: string;
  createdAt: string;
};

export type StaffLeadDetail = StaffLeadSummary & {
  whatsapp: string;
  country: string;
  travelDate: string;
  returnDate: string;
  adults: number | null;
  children: number | null;
  infants: number | null;
  assignedUser: string;
  assignedAgent: string;
};

export type StaffLeadPage = {
  data: StaffLeadSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type StaffLeadResult<T> =
  | { status: "ok"; data: T }
  | { status: "signed-out" | "forbidden" | "unavailable" }
  | { status: "not-found" };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, max = 300): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function dateText(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? "" : value.toISOString();
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : "";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function readSummary(value: unknown): StaffLeadSummary | null {
  const row = record(value);
  if (!row) return null;
  const id = text(row.id, 80);
  const leadNumber = text(row.leadNumber, 80);
  const fullName = text(row.fullName, 160);
  const mobile = text(row.mobile, 40);
  const status = text(row.status, 40);
  if (!id || !leadNumber || !fullName || !mobile || !status) return null;
  return {
    id,
    leadNumber,
    fullName,
    mobile,
    email: text(row.email, 254),
    city: text(row.city, 120),
    status,
    source: text(row.source, 40),
    priority: text(row.priority, 40),
    createdAt: dateText(row.createdAt),
  };
}

export function parseStaffLeadPage(value: unknown): StaffLeadPage | null {
  const body = record(value);
  if (
    !body ||
    !Array.isArray(body.data) ||
    typeof body.total !== "number" ||
    !Number.isSafeInteger(body.total) ||
    body.total < 0 ||
    typeof body.page !== "number" ||
    !Number.isSafeInteger(body.page) ||
    body.page < 1 ||
    typeof body.pageSize !== "number" ||
    !Number.isSafeInteger(body.pageSize) ||
    body.pageSize < 1
  ) {
    return null;
  }
  const data: StaffLeadSummary[] = [];
  for (const row of body.data) {
    const item = readSummary(row);
    if (!item) return null;
    data.push(item);
  }
  return { data, total: body.total, page: body.page, pageSize: body.pageSize };
}

export function parseStaffLeadDetail(value: unknown): StaffLeadDetail | null {
  const row = record(value);
  const summary = readSummary(row);
  if (!row || !summary) return null;
  const assignedUser = record(row.assignedUser);
  const assignedAgent = record(row.assignedAgent);
  return {
    ...summary,
    whatsapp: text(row.whatsapp, 40),
    country: text(row.country, 120),
    travelDate: dateText(row.travelDate),
    returnDate: dateText(row.returnDate),
    adults: count(row.adults),
    children: count(row.children),
    infants: count(row.infants),
    assignedUser: text(assignedUser?.fullName, 160),
    assignedAgent: text(assignedAgent?.name, 160),
  };
}
