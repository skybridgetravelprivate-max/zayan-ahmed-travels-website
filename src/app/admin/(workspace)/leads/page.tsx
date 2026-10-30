import { redirect } from "next/navigation";
export const metadata = {
  title: "Inquiries and leads",
  robots: { index: false, follow: false },
};
export default async function LegacyLeadList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams,
    params = new URLSearchParams();
  for (const key of ["q", "page"])
    if (typeof query[key] === "string") params.set(key, query[key] as string);
  redirect(`/admin/manage/leads${params.size ? "?" + params.toString() : ""}`);
}
