const paths = {
  flight: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  visa: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 13h8M9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
  umrah: "M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10ZM18 2v4m-2-2h4",
  tour: "M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm4 0V3h6v4M8 7v14M16 7v14",
  check: "m5 12 4 4L19 6M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z",
  quote: "M5 3h14v18H5V3Zm3 5h8M8 12h8M8 16h4",
  phone:
    "m7 3 3 5-2 2a15 15 0 0 0 6 6l2-2 5 3c-1 4-4 4-7 2A21 21 0 0 1 5 10C3 7 3 4 7 3Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-11 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
} as const;

export function TravelIcon({
  name,
  className = "",
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      className={`travel-icon ${className}`}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
