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
    // Treat authenticated restaurant API activity as presence as well. This
    // keeps status accurate even when a browser has cached the dashboard's
    // optional client-side heartbeat module.
    try {
        await request.server.db.query(`update app_users
         set last_activity_at = now()
         where id = $1 and disabled_at is null
           and last_activity_at < now() - interval '1 minute'`, [user.id]);
    } catch (error) {
        request.log.warn({ err: error }, "Could not update account activity timestamp");
    }
    return { user, restaurantId, role: membership.role };
}
