import { requireAuth } from "./auth.js";
export async function requireRestaurantAccess(request, reply, env, restaurantId, allowedRoles = undefined) {
    const user = await requireAuth(request, reply, env);
    if (!user)
        return null;
    if (!request.server.db) {
        await reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        return null;
    }
    const result = await request.server.db.query(`select m.role, r.suspended_at
     from restaurant_members m
     join restaurants r on r.id = m.restaurant_id
     join app_users u on u.id = m.user_id
     where m.restaurant_id = $1 and m.user_id = $2
       and u.disabled_at is null
     limit 1`, [restaurantId, user.id]);
    const membership = result.rows[0];
    if (!membership ||
        membership.suspended_at ||
        (allowedRoles && !allowedRoles.includes(membership.role))) {
        await reply.status(403).send({ ok: false, error: "FORBIDDEN" });
        return null;
    }
    return { user, restaurantId, role: membership.role };
}
