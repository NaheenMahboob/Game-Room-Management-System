/**
 * Shared Prisma client (hot-reload safe in development).
 */

import { PrismaClient } from "@/generated/prisma";

/** Global slot used to reuse one Prisma client across Next.js dev reloads. */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Application-wide Prisma client singleton. */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
