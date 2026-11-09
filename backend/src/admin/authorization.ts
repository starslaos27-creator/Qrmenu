import { requireAuth } from "../security/auth.js";
export async function requirePlatformAdmin(request, reply, env, allowedRoles = undefined) {
    const user = await requireAuth(request, reply, env);
    if (!user)
        return null;
    if (!request.server.db) {
        await reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        return null;
    }
    const result = await request.server.db.query(`select a.role, a.active, u.disabled_at
     from app_admins a
     join app_users u on u.id = a.user_id
     where a.user_id = $1
     limit 1`, [user.id]);
    const admin = result.rows[0];
    if (!admin ||
        !admin.active ||
        admin.disabled_at ||
        (allowedRoles && !allowedRoles.includes(admin.role))) {
        await reply.status(403).send({ ok: false, error: "ADMIN_FORBIDDEN" });
        return null;
    }
    return { user, role: admin.role };
}
