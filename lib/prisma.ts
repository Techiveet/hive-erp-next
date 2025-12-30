// lib/prisma.ts

import { Pool, types } from "pg";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * IMPORTANT:
 * Prisma expects counts/aggregates as JS numbers.
 * If you parse int8 into BigInt globally, Prisma will crash on _count fields.
 *
 * So for OID 20 (int8), parse to Number.
 * (Counts are small; this is safe for app usage.)
 */
types.setTypeParser(20, (val) => Number(val));

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");
  return url;
}

function getOrCreatePgPool(): Pool {
  if (process.env.NODE_ENV !== "production" && globalThis.__pgPool) {
    return globalThis.__pgPool;
  }

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 10000),
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });

  pool.on("error", () => {});

  if (process.env.NODE_ENV !== "production") {
    globalThis.__pgPool = pool;
  }

  return pool;
}

function getOrCreatePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production" && globalThis.__prisma) {
    return globalThis.__prisma;
  }

  const pool = getOrCreatePgPool();
  const adapter = new PrismaPg(pool);

  const isLogging = process.env.PRISMA_LOG_QUERIES === "true";
  const log: any[] = ["error"];
  if (isLogging) log.push("query");

  const client = new PrismaClient({ adapter, log });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = client;
  }

  return client;
}

export const prisma = getOrCreatePrismaClient();

export async function closePrisma(): Promise<void> {
  await prisma.$disconnect().catch(() => {});
  if (globalThis.__pgPool) {
    await globalThis.__pgPool.end().catch(() => {});
    globalThis.__pgPool = undefined;
  }
  globalThis.__prisma = undefined;
}
