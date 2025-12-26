// lib/prisma.ts
// ✅ Adapter-based Prisma client for Postgres (Prisma 7 + @prisma/adapter-pg)

import "dotenv/config";

import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type GlobalPrisma = typeof globalThis & {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const g = globalThis as GlobalPrisma;

function makePrismaClient(): PrismaClient {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error("Missing env: DATABASE_URL");

  // reuse in dev
  if (process.env.NODE_ENV !== "production" && g.prisma) return g.prisma;

  const pool = g.pgPool ?? new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    g.pgPool = pool;
    g.prisma = client;
  }

  return client;
}

export const prisma = makePrismaClient();

export async function closePrisma() {
  await prisma.$disconnect();
  if (g.pgPool) {
    await g.pgPool.end();
    g.pgPool = undefined;
  }
}
