import { notFound, redirect } from "next/navigation";
import { getGuideCategory } from "@/config/travel-guide";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getGuideCategory(slug)) notFound();
  redirect("/travel-guide");
}
