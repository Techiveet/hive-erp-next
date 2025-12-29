import { Pool, types } from "pg";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Postgres int8 (OID 20) -> BigInt (safe)
types.setTypeParser(20, (val) => BigInt(val));

declare global {
  var __prisma: PrismaClient | undefined;
  var __pgPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || "";
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

  // Silent error handling to prevent terminal noise
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

  // Determine log levels: only "query" if explicitly enabled in .env
  const isLogging = process.env.PRISMA_LOG_QUERIES === "true";
  const logConfig: any[] = ["error"]; 
  if (isLogging) logConfig.push("query");

  const client = new PrismaClient({
    adapter,
    log: logConfig,
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = client;
  }

  return client;
}

export const prisma: PrismaClient = getOrCreatePrismaClient();

export async function closePrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    if (globalThis.__pgPool) {
      await globalThis.__pgPool.end();
      globalThis.__pgPool = undefined;
    }
    globalThis.__prisma = undefined;
  } catch {
    // Silent catch
  }
}