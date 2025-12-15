import { readdir } from 'fs/promises';
import path from 'path';

async function listEntries(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

const repoRoot = process.cwd();
const supabaseDir = path.join(repoRoot, 'supabase', 'migrations');
const prismaDir = path.join(repoRoot, 'prisma', 'migrations');

const supabaseEntries = await listEntries(supabaseDir);
const prismaEntries = (await listEntries(prismaDir)).filter((entry) => entry !== '.gitkeep');

if (prismaEntries.length > 0) {
  console.error('Prisma migrations are not used in this workflow. Please keep prisma/migrations empty and drive schema changes via supabase/migrations.');
  console.error('Detected prisma/migrations entries:', prismaEntries.join(', '));
  process.exit(1);
}

console.log(`Migration guardrail: supabase (${supabaseEntries.length} files) is canonical; prisma/migrations is clean.`);
