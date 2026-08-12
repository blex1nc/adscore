import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Bağlantı önceliği: DATABASE_URL → "neon" (Vercel'de Sensitive olarak bu adla
// kaydedilmiş; Sensitive env yeniden adlandırılamadığı için kod tarafında düşülür).
const databaseUrl = process.env.DATABASE_URL ?? process.env.neon;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
