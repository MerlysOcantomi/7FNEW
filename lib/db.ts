import { createClient } from "@libsql/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const libsql = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN
})

const adapter = new PrismaLibSql(libsql)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma as db }
