// lib/prisma.ts

import { Pool, types } from "pg";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Handle BigInt parsing: Postgres returns BigInts as strings by default.
 * This ensures they are parsed as Numbers (if they fit) or kept as strings consistently.
 */
types.setTypeParser(20, (val) => parseInt(val, 10));

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

/**
 * Validates and retrieves the database connection string.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[PRISMA] ❌ Missing DATABASE_URL in environment variables.");
    throw new Error("Missing env: DATABASE_URL");
  }
  return url;
}

/**
 * Creates or reuses a node-postgres Pool.
 */
function getOrCreatePgPool(): Pool {
  if (process.env.NODE_ENV !== "production" && globalThis.__pgPool) {
    return globalThis.__pgPool;
  }

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 10000),
    // Recommended for serverless/highly dynamic environments:
    allowExitOnIdle: true, 
  });

  // Error handling for the pool to prevent app crashes on silent connection drops
  pool.on("error", (err) => {
    console.error("[POSTGRES] ❌ Unexpected error on idle client", err);
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__pgPool = pool;
  }

  return pool;
}

/**
 * Creates or reuses the Prisma Client with the Postgres Adapter.
 */
function getOrCreatePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production" && globalThis.__prisma) {
    return globalThis.__prisma;
  }

  const pool = getOrCreatePgPool();
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" 
      ? ["query", "info", "warn", "error"] 
      : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = client;
  }

  return client;
}

/**
 * The single Prisma instance used across the application.
 */
export const prisma: PrismaClient = getOrCreatePrismaClient();

/**
 * Teardown utility for scripts (like seed.ts) or testing suites.
 */
export async function closePrisma(): Promise<void> {
  console.log("[PRISMA] 🔌 Disconnecting...");
  
  await prisma.$disconnect();

  if (globalThis.__pgPool) {
    await globalThis.__pgPool.end();
    globalThis.__pgPool = undefined;
  }

  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = undefined;
  }
}