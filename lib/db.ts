import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Singleton Prisma client (SQLite via driver adapter). Cached on globalThis so
// Next.js dev hot reloads do not open a new connection on every module reload.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveSqlitePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return url.startsWith("file:") ? url.slice("file:".length) : url;
}

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath() });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
