import type { Metadata } from "next";
import { ManagementHub } from "@/components/admin/ManagementWorkspace";
export const metadata: Metadata = { title: "Management", robots: { index: false, follow: false } };
export default function ManagementPage() { return <ManagementHub />; }
