import { PrismaClient } from "@prisma/client";

// Em desenvolvimento o Next recarrega os módulos a cada alteração; sem o cache
// no globalThis, cada reload abriria um novo pool de conexões.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
