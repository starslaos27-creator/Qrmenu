import { requirePlatformAdmin } from "../admin/authorization.js";
const currencies = ["LAK", "THB", "USD"];
const paymentMethods = ["cash", "transfer", "qr", "card", "other"];
const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function isDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function createPlatformFinanceController(app, env) {
    const get_api_admin_finance = async (request, reply) => {
        if (!await requirePlatformAdmin(request, reply, env))
            return;
        const { kind, from, to } = request.query;
        const currency = request.query.currency ?? "all";
        const page = clampInteger(request.query.page, 1, 1, 100_000);
        const pageSize = 50;
        if (!(["income", "expense"].includes(kind)) || !isDate(from) || !isDate(to) || from > to ||
            !(currency === "all" || currencies.includes(currency))) {
            return reply.code(400).send({ error: "INVALID_FILTER" });
        }
        const [entriesResult, summaryResult, categoryResult] = await Promise.all([
            app.db.query(`select e.id, e.request_key, e.kind, e.entry_date, e.category, e.description,
            e.amount::text, e.currency_code, e.payment_method, e.reference, e.source,
            e.restaurant_id, r.name as restaurant_name, e.pro_request_id, e.created_at,
            e.voided_at, e.void_reason, creator.email as created_by_email,
            voider.email as voided_by_email
         from platform_finance_entries e
         left join restaurants r on r.id=e.restaurant_id
         left join app_users creator on creator.id=e.created_by
         left join app_users voider on voider.id=e.voided_by
         where e.kind=$1 and e.entry_date between $2::date and $3::date
           and ($4='all' or e.currency_code=$4)
         order by e.entry_date desc, e.created_at desc, e.id desc
         limit $5 offset $6`, [kind, from, to, currency, pageSize, (page - 1) * pageSize]),
            app.db.query(`select e.currency_code,
            coalesce(sum(e.amount) filter (where e.voided_at is null), 0)::text as amount,
            count(*) filter (where e.voided_at is null)::int as entry_count,
            count(*) filter (where e.source='pro_package' and e.voided_at is null)::int as pro_package_count
         from platform_finance_entries e
         where e.kind=$1 and e.entry_date between $2::date and $3::date
           and ($4='all' or e.currency_code=$4)
         group by e.currency_code
         order by e.currency_code`, [kind, from, to, currency]),
            app.db.query(`select e.currency_code, e.category,
            coalesce(sum(e.amount), 0)::text as amount, count(*)::int as entry_count
         from platform_finance_entries e
         where e.kind=$1 and e.entry_date between $2::date and $3::date
           and e.voided_at is null and ($4='all' or e.currency_code=$4)
         group by e.currency_code, e.category
         order by e.currency_code, sum(e.amount) desc, e.category`, [kind, from, to, currency]),
        ]);
        return reply.send({ entries: entriesResult.rows, summary: summaryResult.rows, categories: categoryResult.rows, page, pageSize });
    };
    const post_api_admin_finance = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]);
        if (!admin)
            return;
        const body = request.body || {};
        const amount = typeof body.amount === "string" ? body.amount.trim() : "";
        const category = typeof body.category === "string" ? body.category.trim() : "";
        const description = typeof body.description === "string" ? body.description.trim() : "";
        const reference = typeof body.reference === "string" ? body.reference.trim() : "";
        if (!uuid(body.requestKey) || !["income", "expense"].includes(body.kind) || !isDate(body.entryDate) ||
            category.length < 1 || category.length > 100 || description.length < 1 || description.length > 500 ||
            !/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 999999999999.99 ||
            !currencies.includes(body.currencyCode) || !paymentMethods.includes(body.paymentMethod) || reference.length > 200) {
            return reply.code(400).send({ error: "INVALID_ENTRY" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const existing = (await client.query("select * from platform_finance_entries where request_key=$1", [body.requestKey])).rows[0];
            if (existing) {
                await client.query("rollback");
                if (existing.created_by !== admin.user.id || existing.kind !== body.kind || existing.entry_date !== body.entryDate ||
                    existing.category !== category || existing.description !== description || Number(existing.amount) !== Number(amount) ||
                    existing.currency_code !== body.currencyCode || existing.payment_method !== body.paymentMethod || existing.reference !== reference) {
                    return reply.code(409).send({ error: "REQUEST_CONFLICT" });
                }
                return reply.send({ entry: existing });
            }
            const entry = (await client.query(`insert into platform_finance_entries
          (request_key, kind, entry_date, category, description, amount, currency_code, payment_method, reference, created_by)
        values ($1, $2, $3::date, $4, $5, $6::numeric, $7, $8, $9, $10)
        returning *`, [body.requestKey, body.kind, body.entryDate, category, description, amount,
                body.currencyCode, body.paymentMethod, reference, admin.user.id])).rows[0];
            await client.query(`insert into platform_admin_audit_logs
          (admin_user_id, action, target_type, target_id, reason, details, ip_address)
        values ($1, 'platform_finance.entry_created', 'platform_finance_entry', $2,
          'manual_entry', $3::jsonb, $4)`, [admin.user.id, entry.id,
                JSON.stringify({ kind: body.kind, entryDate: body.entryDate, category, amount, currency: body.currencyCode,
                    paymentMethod: body.paymentMethod, reference }), request.ip]);
            await client.query("commit");
            return reply.code(201).send({ entry });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    const post_api_admin_finance_entry_void = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env, ["super_admin", "support"]);
        if (!admin)
            return;
        const entryId = request.params.entryId;
        const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
        if (!uuid(entryId) || reason.length < 1 || reason.length > 1000) {
            return reply.code(400).send({ error: "INVALID_VOID" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const existing = (await client.query("select * from platform_finance_entries where id=$1 for update", [entryId])).rows[0];
            if (!existing) {
                await client.query("rollback");
                return reply.code(404).send({ error: "NOT_FOUND" });
            }
            if (existing.source !== "manual") {
                await client.query("rollback");
                return reply.code(409).send({ error: "AUTOMATIC_ENTRY_IMMUTABLE" });
            }
            if (existing.voided_at) {
                await client.query("rollback");
                return reply.code(409).send({ error: "ALREADY_VOIDED" });
            }
            const entry = (await client.query(`update platform_finance_entries
          set voided_at=clock_timestamp(), voided_by=$2, void_reason=$3
        where id=$1 returning *`, [entryId, admin.user.id, reason])).rows[0];
            await client.query(`insert into platform_admin_audit_logs
          (admin_user_id, action, target_type, target_id, reason, details, ip_address)
        values ($1, 'platform_finance.entry_voided', 'platform_finance_entry', $2,
          $3, $4::jsonb, $5)`, [admin.user.id, entry.id, reason,
                JSON.stringify({ kind: entry.kind, amount: entry.amount, currency: entry.currency_code }), request.ip]);
            await client.query("commit");
            return reply.send({ entry });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    return { get_api_admin_finance, post_api_admin_finance, post_api_admin_finance_entry_void };
}
function clampInteger(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
