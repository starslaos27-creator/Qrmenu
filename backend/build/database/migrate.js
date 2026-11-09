import { config as loadDotenv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
const configuredEnvFile = process.env.SHOPQR_ENV_FILE?.trim();
loadDotenv({ path: [...(configuredEnvFile ? [configuredEnvFile] : []), ".env.local", ".env"] });
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
}
const migrationsDirectory = path.resolve(process.cwd(), "migrations");
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: readBoolean("DATABASE_SSL", false)
        ? { rejectUnauthorized: readBoolean("DATABASE_SSL_REJECT_UNAUTHORIZED", true) }
        : undefined,
});
async function main() {
    const client = await pool.connect();
    try {
        await client.query("select pg_advisory_lock(hashtext('shopqr:migrations'))");
        await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
        const files = (await readdir(migrationsDirectory))
            .filter((name) => /^\d+.*\.sql$/.test(name))
            .sort();
        for (const name of files) {
            const alreadyApplied = await client.query("select exists(select 1 from schema_migrations where name = $1) as exists", [name]);
            if (alreadyApplied.rows[0]?.exists) {
                console.log(`skip ${name}`);
                continue;
            }
            const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
            await client.query("begin");
            try {
                await client.query(sql);
                await client.query("insert into schema_migrations (name) values ($1)", [name]);
                await client.query("commit");
                console.log(`applied ${name}`);
            }
            catch (error) {
                await client.query("rollback");
                throw error;
            }
        }
    }
    finally {
        await client.query("select pg_advisory_unlock(hashtext('shopqr:migrations'))").catch(() => { });
        client.release();
        await pool.end();
    }
}
function readBoolean(name, fallback) {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value)
        return fallback;
    if (value === "true" || value === "1")
        return true;
    if (value === "false" || value === "0")
        return false;
    throw new Error(`${name} must be true or false`);
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
