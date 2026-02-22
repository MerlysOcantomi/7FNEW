import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
const dbToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

if (!dbUrl) {
  throw new Error("DATABASE_URL or TURSO_DATABASE_URL must be set")
}

const adapter = new PrismaLibSql({ url: dbUrl, authToken: dbToken })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma as db }
