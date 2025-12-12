import dotenv from "dotenv";
import { Client } from "pg";

const envResult =
  dotenv.config({ path: ".env.local" }).parsed ?? dotenv.config().parsed;

if (!envResult) {
  console.warn("No .env.local or .env file found; relying on process env.");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL is missing. Ensure you copied the Supabase pooler connection string into .env.local."
  );
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("SELECT 1 as ok;");
  console.log("DB OK");
} catch (error) {
  console.error("DB connection failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
