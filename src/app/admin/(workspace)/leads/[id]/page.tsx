import { redirect } from "next/navigation";
export const metadata = {
  title: "Lead details",
  robots: { index: false, follow: false },
};
export default async function LegacyLeadRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/manage/leads?record=${encodeURIComponent(id)}`);
}
