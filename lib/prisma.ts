import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

function ensureDatabaseUrl() {
  if (!databaseUrl) {
    throw new Error(
      "Invalid DATABASE_URL. Paste the Supabase pooler connection string (Session:5432 or Transaction:6543) with correct postgres.<project_ref> username."
    );
  }

  if (!databaseUrl.includes("pooler.supabase.com")) {
    throw new Error(
      "Invalid DATABASE_URL. Paste the Supabase pooler connection string (Session:5432 or Transaction:6543) with correct postgres.<project_ref> username."
    );
  }

  if (!databaseUrl.includes("@aws-1-us-east-1.pooler.supabase.com")) {
    throw new Error(
      "Invalid DATABASE_URL. Paste the Supabase pooler connection string (Session:5432 or Transaction:6543) with correct postgres.<project_ref> username."
    );
  }

  if (!/\/postgres($|\?)/.test(databaseUrl)) {
    throw new Error(
      "Invalid DATABASE_URL. Paste the Supabase pooler connection string (Session:5432 or Transaction:6543) with correct postgres.<project_ref> username."
    );
  }
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
