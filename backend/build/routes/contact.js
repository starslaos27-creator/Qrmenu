import { requirePlatformAdmin } from "../admin/authorization.js";
import { createHash } from "node:crypto";
const attempts = new Map();
export async function registerContactRoutes(app, env) {
    app.post("/api/public/contact", { bodyLimit: 16384 }, async (request, reply) => {
        if (!app.db)
            return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        const body = request.body ?? {};
        const clean = (value) => typeof value === "string" ? value.trim() : "";
        const name = clean(body.name), email = clean(body.email), subject = clean(body.subject), message = clean(body.message);
        if (!name || name.length > 100 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || subject.length > 150 || !message || message.length > 5000) {
            return reply.status(400).send({ ok: false, error: "INVALID_BODY" });
        }
        const now = Date.now();
        for (const [key, entry] of attempts)
            if (entry.expires <= now)
                attempts.delete(key);
        const key = createHash("sha256").update(`${request.ip}\0${email.toLowerCase()}`).digest("hex");
        if (!attempts.has(key) && attempts.size >= 10000)
            return reply.status(429).send({ ok: false, error: "RATE_LIMITED" });
        const entry = attempts.get(key) ?? { count: 0, expires: now + 600000 };
        if (entry.count >= 5)
            return reply.status(429).send({ ok: false, error: "RATE_LIMITED" });
        entry.count++;
        attempts.set(key, entry);
        await app.db.query("insert into platform_contact_messages (name,email,subject,message) values ($1,$2,$3,$4)", [name, email, subject, message]);
        return reply.status(201).send({ ok: true });
    });
    app.get("/api/admin/contact-messages", async (request, reply) => {
        if (!await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]))
            return;
        const result = await app.db.query("select id, name, email, subject, message, created_at from platform_contact_messages order by created_at desc, id desc limit 200");
        return reply.send({ ok: true, messages: result.rows });
    });
    app.get("/api/admin/contact-messages/count", async (request, reply) => {
        if (!await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]))
            return;
        const result = await app.db.query("select count(*)::int as count from platform_contact_messages");
        return reply.send({ ok: true, count: result.rows[0].count });
    });
}
