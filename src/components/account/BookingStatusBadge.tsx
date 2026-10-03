import type { BookingStatus } from "@/config/account";

const statusClass: Record<BookingStatus, string> = {
  Upcoming: "bg-zayan-orange/10 text-zayan-orange",
  Completed: "bg-zayan-blue/10 text-zayan-blue",
  Cancelled: "bg-background text-muted",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <p
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${statusClass[status]}`}
    >
      {status}
    </p>
  );
}
