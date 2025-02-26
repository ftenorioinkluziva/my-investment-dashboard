// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

// Prevenção para ambiente de desenvolvimento com hot-reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma