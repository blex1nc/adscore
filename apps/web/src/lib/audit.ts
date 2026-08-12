import "server-only";
import { prisma, type Prisma } from "@adscore/db";

// CLAUDE.md §41 — önemli işlemler loglanır
export async function audit(entry: {
  workspaceId?: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({ data: entry });
}
