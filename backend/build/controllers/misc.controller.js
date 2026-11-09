import { requireRestaurantAccess } from "../security/authorization.js";
export function createMiscController(app, env) {
    const get_api_restaurants_restaurantId_audit_logs = async (request, reply) => {
        const access = await accessRestaurant(request, reply, env);
        if (!access)
            return;
        const requestedLimit = Number(request.query.limit ?? 300);
        const limit = Number.isSafeInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 500)
            : 300;
        const result = await app.db.query(`select id, action, target_id, details, created_at, actor_user_id
       from audit_logs where restaurant_id = $1
       order by created_at desc limit $2`, [access.restaurantId, limit]);
        return reply.send({ ok: true, logs: result.rows });
    };
    const get_api_restaurants_restaurantId_feedback = async (request, reply) => {
        const access = await accessRestaurant(request, reply, env);
        if (!access)
            return;
        const result = await app.db.query(`select * from feedback
         where user_id = $1 and restaurant_id = $2
         order by created_at desc`, [access.user.id, access.restaurantId]);
        return reply.send({ ok: true, feedback: result.rows });
    };
    const post_api_restaurants_restaurantId_feedback = async (request, reply) => {
        const access = await accessRestaurant(request, reply, env);
        if (!access)
            return;
        const message = request.body?.message?.trim() ?? "";
        const category = request.body?.category ?? "general";
        const email = request.body?.email?.trim() || null;
        if (message.length < 5 ||
            message.length > 2_000 ||
            !["bug", "feature", "general", "question"].includes(category) ||
            (email && email.length > 320)) {
            return reply.status(400).send({ ok: false, error: "INVALID_BODY" });
        }
        const result = await app.db.query(`insert into feedback
        (user_id, restaurant_id, email, category, message)
       values ($1,$2,$3,$4,$5)
       returning *`, [access.user.id, access.restaurantId, email, category, message]);
        return reply.status(201).send({ ok: true, feedback: result.rows[0] });
    };
    return { get_api_restaurants_restaurantId_audit_logs, get_api_restaurants_restaurantId_feedback, post_api_restaurants_restaurantId_feedback };
}
async function accessRestaurant(request, reply, env) {
    if (!isUuid(request.params.restaurantId)) {
        void reply.status(400).send({ ok: false, error: "INVALID_ID" });
        return null;
    }
    return requireRestaurantAccess(request, reply, env, request.params.restaurantId);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
