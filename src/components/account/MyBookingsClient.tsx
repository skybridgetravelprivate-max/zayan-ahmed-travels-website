"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingList } from "@/components/account/BookingList";
import { AccountState } from "@/components/account/AccountState";
import {
  parseAccountBookingsResponse,
  type AccountBooking,
} from "@/lib/account-bookings";

type ViewState =
  | { status: "loading" }
  | { status: "ready"; bookings: AccountBooking[] }
  | { status: "verification" }
  | { status: "error" };

export function MyBookingsClient() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/account/bookings", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (!active) return;
        if (response.status === 403) { setView({ status: "verification" }); return; }

        const parsed = parseAccountBookingsResponse(response.status, body);
        if (!parsed.ok) {
          if (parsed.kind === "unauthorized") {
            router.refresh();
            return;
          }
          setView({ status: "error" });
          return;
        }
        setView({ status: "ready", bookings: parsed.bookings });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        void error;
        setView({ status: "error" });
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [router]);

  if (view.status === "verification") {
    return <AccountState status="empty" title="Verify your account with our staff" message="Contact our travel desk to confirm ownership before we display your booking details." />;
  }

  if (view.status === "loading") {
    return <BookingList bookings={[]} status="loading" />;
  }

  if (view.status === "error") {
    return <BookingList bookings={[]} status="error" />;
  }

  return <BookingList bookings={view.bookings} status="ready" />;
}
