import { setDefaultAutoSelectFamily } from "node:net";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

setDefaultAutoSelectFamily(false);

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set");

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
      alter table public.schema_migrations enable row level security;
    `);

    const { rows } = await client.query<{ name: string }>(
      "select name from public.schema_migrations",
    );
    const applied = new Set(rows.map((r) => r.name));

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log("Nothing to apply, database is up to date.");
      return;
    }

    for (const file of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into public.schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log(`applied  ${file}`);
      } catch (err) {
        await client.query("rollback");
        console.error(`failed   ${file}`);
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
