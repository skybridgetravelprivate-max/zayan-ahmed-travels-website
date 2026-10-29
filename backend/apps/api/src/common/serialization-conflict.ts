import { Prisma } from "@prisma/client";

/** Prisma reports raw SQL lock conflicts differently from model-write conflicts. */
export function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))));
}
