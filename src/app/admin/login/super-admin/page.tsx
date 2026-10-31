import type { Metadata } from "next";
import { LoginPortalPage } from "@/components/admin/LoginPortalPage";

export const metadata: Metadata = { title: "Super Admin sign in", robots: { index: false, follow: false } };
export default function Page() { return <LoginPortalPage portal="super-admin" />; }
