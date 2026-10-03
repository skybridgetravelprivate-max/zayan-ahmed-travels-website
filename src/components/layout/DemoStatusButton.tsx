"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function DemoStatusButton({ label, status }: { label: string; status: string }) {
  const [noted, setNoted] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setNoted(true)}>
        {label}
      </Button>
      {noted ? (
        <p role="status" className="text-sm font-medium text-white">
          {status}
        </p>
      ) : null}
    </>
  );
}
