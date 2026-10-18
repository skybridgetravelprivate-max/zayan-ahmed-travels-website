import "server-only";
import { staffRequest, type StaffApiPath } from "@/server/staff-api";
import {
  parseStaffLeadDetail,
  parseStaffLeadPage,
  type StaffLeadDetail,
  type StaffLeadPage,
  type StaffLeadResult,
} from "@/lib/staff-leads";

async function requestJson<T>(
  path: StaffApiPath,
  parse: (value: unknown) => T | null,
  request: typeof staffRequest,
  detail: boolean,
): Promise<StaffLeadResult<T>> {
  try {
    const response = await request(path);
    if (!response || response.status === 401) return { status: "signed-out" };
    if (response.status === 403) return { status: "forbidden" };
    if (detail && response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable" };
    const data = parse(await response.json());
    return data === null ? { status: "unavailable" } : { status: "ok", data };
  } catch {
    return { status: "unavailable" };
  }
}

export function fetchStaffLeadPage(
  page: number,
  query: string,
  request: typeof staffRequest = staffRequest,
): Promise<StaffLeadResult<StaffLeadPage>> {
  if (!Number.isInteger(page) || page < 1 || page > 10000 || query.length > 100) {
    return Promise.resolve({ status: "unavailable" });
  }
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (query) params.set("q", query);
  return requestJson<StaffLeadPage>(
    `/api/v1/leads?${params.toString()}`,
    parseStaffLeadPage,
    request,
    false,
  );
}

export function fetchStaffLead(
  id: string,
  request: typeof staffRequest = staffRequest,
) : Promise<StaffLeadResult<StaffLeadDetail>> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
    return Promise.resolve({ status: "not-found" });
  }
  return requestJson<StaffLeadDetail>(
    `/api/v1/leads/${id}`,
    parseStaffLeadDetail,
    request,
    true,
  );
}
