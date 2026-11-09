import { Pool } from "pg";
export function registerDatabase(app, env) {
    if (!env.databaseUrl) {
        app.decorate("db", null);
        return;
    }
    const pool = new Pool({
        connectionString: env.databaseUrl,
        ssl: env.databaseSsl
            ? { rejectUnauthorized: env.databaseSslRejectUnauthorized }
            : undefined,
    });
    app.decorate("db", pool);
    app.addHook("onClose", async () => {
        await pool.end();
    });
}
