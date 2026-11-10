import { requireRestaurantAccess } from "../security/authorization.js";
import { requirePlatformAdmin } from "../admin/authorization.js";
const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const joins = `from pro_requests p join restaurants r on r.id=p.restaurant_id
  join app_users u on u.id=p.requested_by left join app_users a on a.id=p.reviewed_by`;
const columns = `p.*, r.name as restaurant_name, u.email as requester_email, a.email as reviewer_email`;
export function createProRequestController(app, env) {
    async function readPricing(reply) {
        if (!app.db)
            return reply.code(503).send({ error: "DATABASE_NOT_CONFIGURED" });
        const result = await app.db.query("select monthly_usd,version,updated_at from pro_pricing where id=true");
        reply.header("Cache-Control", "no-store");
        return result.rows[0];
    }
    const get_api_pro_pricing = async (request, reply) => readPricing(reply);
    const get_api_admin_pro_pricing = async (request, reply) => {
        if (!await requirePlatformAdmin(request, reply, env))
            return;
        return readPricing(reply);
    };
    const put_api_admin_pro_pricing = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]);
        if (!admin)
            return;
        const b = request.body || {};
        if (typeof b.monthlyUsd !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(b.monthlyUsd) || Number(b.monthlyUsd) <= 0 || Number(b.monthlyUsd) > 1000000 || !Number.isSafeInteger(b.version))
            return reply.code(400).send({ error: "INVALID_PRICE" });
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const previous = (await client.query("select * from pro_pricing where id=true for update")).rows[0];
            if (previous.version !== b.version) {
                await client.query("rollback");
                return reply.code(409).send({ error: "PRICE_CHANGED" });
            }
            const result = await client.query("update pro_pricing set monthly_usd=$1,version=version+1,updated_by=$2,updated_at=now() where id=true returning monthly_usd,version,updated_at", [b.monthlyUsd, admin.user.id]);
            await client.query(`insert into platform_admin_audit_logs(admin_user_id,action,target_type,details,ip_address)
        values($1,'pro_pricing.updated','pro_pricing',$2::jsonb,$3)`, [admin.user.id, JSON.stringify({ previousMonthlyUsd: previous.monthly_usd, monthlyUsd: result.rows[0].monthly_usd, currency: "USD" }), request.ip]);
            await client.query("commit");
            return result.rows[0];
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    const get_api_restaurants_restaurantId_pro_countdown = async (request, reply) => {
        if (!uuid(request.params.restaurantId))
            return reply.code(400).send({ error: "INVALID_RESTAURANT" });
        if (!await requireRestaurantAccess(request, reply, env, request.params.restaurantId))
            return;
        const result = await app.db.query(`with clock as (
        select clock_timestamp() as server_now
      ), paid as (
        select max(reviewed_at + (paid_months + free_months) * interval '30 days') as expires_at
        from pro_requests where restaurant_id=$1 and status='approved'
      ), trial as (
        select starts_at, expires_at from restaurant_pro_trials where restaurant_id=$1
      )
      select greatest(paid.expires_at, trial.expires_at) as expires_at,
        clock.server_now,
        exists(select 1 from pro_requests where restaurant_id=$1 and status='pending') as pending,
        coalesce(trial.expires_at > clock.server_now and
          (paid.expires_at is null or trial.expires_at >= paid.expires_at), false) as trial_active
      from clock cross join paid left join trial on true`, [request.params.restaurantId]);
        reply.header("Cache-Control", "no-store");
        return result.rows[0];
    };
    async function owner(request, reply) {
        if (!uuid(request.params.restaurantId)) {
            reply.code(400).send({ error: "INVALID_RESTAURANT" });
            return null;
        }
        return requireRestaurantAccess(request, reply, env, request.params.restaurantId, ["owner"]);
    }
    const get_api_restaurants_restaurantId_pro_requests = async (request, reply) => {
        if (!await owner(request, reply))
            return;
        const offset = Math.max(0, Math.min(100000, Number(request.query.offset) || 0)) | 0;
        const result = await app.db.query(`select ${columns} ${joins} where p.restaurant_id=$1 order by p.created_at desc, p.id desc limit 50 offset $2`, [request.params.restaurantId, offset]);
        return { requests: result.rows };
    };
    const post_api_restaurants_restaurantId_pro_requests = async (request, reply) => {
        const auth = await owner(request, reply);
        if (!auth)
            return;
        const body = request.body || {};
        if (!uuid(body.requestKey) || ![1, 3, 6, 9, 12].includes(body.paidMonths) ||
            typeof body.monthlyUsd !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(body.monthlyUsd) ||
            Number(body.monthlyUsd) <= 0 || Number(body.monthlyUsd) > 1000000) {
            return reply.code(400).send({ error: "INVALID_REQUEST" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            await client.query("select pg_advisory_xact_lock(hashtext($1))", [`pro:${auth.restaurantId}`]);
            await client.query("select id from restaurants where id=$1 for update", [auth.restaurantId]);
            const existing = (await client.query("select * from pro_requests where request_key=$1", [body.requestKey])).rows[0];
            if (existing) {
                await client.query("rollback");
                if (existing.restaurant_id !== auth.restaurantId || existing.requested_by !== auth.user.id || existing.paid_months !== body.paidMonths || Number(existing.monthly_usd) !== Number(body.monthlyUsd))
                    return reply.code(409).send({ error: "REQUEST_CONFLICT" });
                return { request: existing };
            }
            const active = (await client.query(`select max(reviewed_at + (paid_months + free_months) * interval '30 days') as expires_at
        from pro_requests where restaurant_id=$1 and status='approved'
        having max(reviewed_at + (paid_months + free_months) * interval '30 days') > clock_timestamp()`, [auth.restaurantId])).rows[0];
            if (active) {
                await client.query("rollback");
                return reply.code(409).send({ error: "PRO_ACTIVE", expiresAt: active.expires_at });
            }
            const trial = (await client.query("select expires_at from restaurant_pro_trials where restaurant_id=$1 and expires_at>clock_timestamp() for update", [auth.restaurantId])).rows[0];
            if (trial) {
                await client.query("rollback");
                return reply.code(409).send({ error: "PRO_ACTIVE", expiresAt: trial.expires_at, trial: true });
            }
            const pending = (await client.query("select id from pro_requests where restaurant_id=$1 and status='pending'", [auth.restaurantId])).rows[0];
            if (pending) {
                await client.query("rollback");
                return reply.code(409).send({ error: "REQUEST_PENDING" });
            }
            const free = body.paidMonths === 12 ? 2 : [6, 9].includes(body.paidMonths) ? 1 : 0;
            const pricing = (await client.query("select monthly_usd from pro_pricing where id=true for share")).rows[0];
            if (!pricing?.monthly_usd || Number(pricing.monthly_usd) !== Number(body.monthlyUsd)) {
                await client.query("rollback");
                return reply.code(409).send({ error: "PRICE_CHANGED" });
            }
            const result = await client.query(`insert into pro_requests (request_key,restaurant_id,requested_by,paid_months,free_months,monthly_usd,total_usd)
        values ($1,$2,$3,$4::integer,$5,$6::numeric,$6::numeric*$4::integer) returning *`, [body.requestKey, auth.restaurantId, auth.user.id, body.paidMonths, free, pricing.monthly_usd]);
            await client.query("commit");
            return reply.code(201).send({ request: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    const get_api_admin_pro_requests = async (request, reply) => {
        if (!await requirePlatformAdmin(request, reply, env))
            return;
        const status = request.query.status || "all";
        if (!["all", "pending", "approved", "rejected"].includes(status))
            return reply.code(400).send({ error: "INVALID_STATUS" });
        const offset = Math.max(0, Math.min(100000, Number(request.query.offset) || 0)) | 0;
        const result = await app.db.query(`select ${columns} ${joins} where ($1='all' or p.status=$1) order by p.created_at desc,p.id desc limit 50 offset $2`, [status, offset]);
        return { requests: result.rows };
    };
    const post_api_admin_pro_requests_id_review = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]);
        if (!admin)
            return;
        const body = request.body || {};
        if (!uuid(request.params.id) || !["approved", "rejected"].includes(body.status) || (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000)))
            return reply.code(400).send({ error: "INVALID_REVIEW" });
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const row = (await client.query("select * from pro_requests where id=$1 for update", [request.params.id])).rows[0];
            if (!row) {
                await client.query("rollback");
                return reply.code(404).send({ error: "NOT_FOUND" });
            }
            if (row.status !== "pending") {
                await client.query("rollback");
                if (row.status === body.status)
                    return { request: row };
                return reply.code(409).send({ error: "ALREADY_REVIEWED" });
            }
            await client.query("select id from restaurants where id=$1 for update", [row.restaurant_id]);
            const result = await client.query(`update pro_requests set status=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4 where id=$1 returning *`, [row.id, body.status, admin.user.id, body.note?.trim() || ""]);
            await client.query(`insert into platform_admin_audit_logs (admin_user_id,action,target_type,target_id,restaurant_id,reason,details,ip_address)
        values ($1,$2,'pro_request',$3,$4,$5,$6::jsonb,$7)`, [admin.user.id, `pro_request.${body.status}`, row.id, row.restaurant_id, body.note?.trim() || "", JSON.stringify({ paidMonths: row.paid_months, totalUsd: row.total_usd, currency: "USD", mode: "history_only" }), request.ip]);
            await client.query("commit");
            return { request: result.rows[0] };
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    return { get_api_pro_pricing, get_api_admin_pro_pricing, put_api_admin_pro_pricing, get_api_restaurants_restaurantId_pro_countdown, get_api_restaurants_restaurantId_pro_requests, post_api_restaurants_restaurantId_pro_requests, get_api_admin_pro_requests, post_api_admin_pro_requests_id_review };
}
