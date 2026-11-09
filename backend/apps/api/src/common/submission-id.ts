import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";

export function submissionId(operation: string, scope: string[], key: unknown) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) {
    throw new BadRequestException("A valid Idempotency-Key is required");
  }
  return `${operation}:${createHash("sha256").update(JSON.stringify([...scope, key])).digest("hex")}`;
}
