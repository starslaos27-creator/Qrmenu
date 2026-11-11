import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRefreshSession, hashPassword, normalizeEmail, setRefreshCookie, signAccessToken, validatePassword, verifyPassword, } from "../security/auth.js";
import { clearLoginFailures, recordLoginFailure } from "../security/login-failures.js";
import { requirePlatformAdmin, } from "../admin/authorization.js";

export function createAdminController(app, env) {
  const post_api_admin_auth_forgot_password = async (request, reply) => {
    if (!app.db) return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
    if (!env.resendApiKey || !env.mailFrom || !env.adminPublicUrl) return reply.status(503).send({ ok: false, error: "PASSWORD_RESET_EMAIL_NOT_CONFIGURED" });
    const email = normalizeEmail(request.body?.email ?? "");
    if (!isValidEmail(email)) return reply.send({ ok: true });
    const adminResult = await app.db.query(`select u.id, u.email
      from app_users u join app_admins a on a.user_id=u.id
      where lower(u.email)=$1 and u.disabled_at is null and a.active=true limit 1`, [email]);
    const admin = adminResult.rows[0];
    if (!admin) return reply.send({ ok: true });

    const client = await app.db.connect();
    let resetToken = "";
    try {
      await client.query("begin");
      const recent = await client.query(`select 1 from password_reset_tokens
        where user_id=$1 and created_at > now() - interval '15 minutes' limit 1`, [admin.id]);
      if (recent.rows.length) {
        await client.query("commit");
        return reply.send({ ok: true });
      }
      resetToken = randomBytes(32).toString("base64url");
      await client.query(`update password_reset_tokens set used_at=coalesce(used_at,now())
        where user_id=$1 and used_at is null`, [admin.id]);
      await client.query(`insert into password_reset_tokens (user_id, token_hash, expires_at)
        values ($1,$2,now() + interval '30 minutes')`, [admin.id, createHash("sha256").update(resetToken).digest()]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }

    const resetUrl = new URL("/", env.adminPublicUrl);
    resetUrl.searchParams.set("reset", resetToken);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.mailFrom,
          to: [admin.email],
          subject: "ShopQR platform admin password reset",
          html: `<p>A password reset was requested for your ShopQR platform admin account.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request this, ignore this email.</p>`,
          text: `Reset your ShopQR platform admin password using this one-time link (expires in 30 minutes): ${resetUrl.toString()}`,
        }),
      });
      if (!response.ok) throw new Error(`Mail provider returned ${response.status}`);
    } catch (error) {
      app.log.error({ err: error }, "Could not send platform admin password reset email");
      await app.db.query(`update password_reset_tokens set used_at=now()
        where user_id=$1 and used_at is null`, [admin.id]);
    }
    return reply.send({ ok: true });
  };
  const get_api_admin_auth_password_reset_token = async (request, reply) => {
    if (!app.db) return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
    const token = typeof request.params.token === "string" ? request.params.token.trim() : "";
    if (!isResetToken(token)) return reply.status(400).send({ ok: false, error: "INVALID_RESET_TOKEN" });
    const result = await app.db.query(`select u.email, t.expires_at
      from password_reset_tokens t join app_users u on u.id=t.user_id
      join app_admins a on a.user_id=u.id
      where t.token_hash=$1 and t.used_at is null and t.expires_at>now()
        and u.disabled_at is null and a.active=true limit 1`, [createHash("sha256").update(token).digest()]);
    if (!result.rows[0]) return reply.status(404).send({ ok: false, error: "RESET_TOKEN_EXPIRED" });
    return reply.send({ ok: true, email: result.rows[0].email, expiresAt: result.rows[0].expires_at });
  };
  const post_api_admin_auth_reset_password = async (request, reply) => {
    if (!app.db) return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
    const token = typeof request.body?.token === "string" ? request.body.token.trim() : "";
    const password = typeof request.body?.newPassword === "string" ? request.body.newPassword : "";
    if (!isResetToken(token)) return reply.status(400).send({ ok: false, error: "INVALID_RESET_TOKEN" });
    const passwordError = validatePassword(password);
    if (passwordError) return reply.status(400).send({ ok: false, error: passwordError });
    const client = await app.db.connect();
    try {
      await client.query("begin");
      const found = await client.query(`select t.id,t.user_id,u.email
        from password_reset_tokens t join app_users u on u.id=t.user_id
        join app_admins a on a.user_id=u.id
        where t.token_hash=$1 and t.used_at is null and t.expires_at>now()
          and u.disabled_at is null and a.active=true for update of t`, [createHash("sha256").update(token).digest()]);
      const row = found.rows[0];
      if (!row) { await client.query("rollback"); return reply.status(404).send({ ok: false, error: "RESET_TOKEN_EXPIRED" }); }
      await client.query(`update app_users set password_hash=$2,
        password_migrated_at=coalesce(password_migrated_at,now()),updated_at=now() where id=$1`, [row.user_id, await hashPassword(password)]);
      await client.query("update password_reset_tokens set used_at=now() where id=$1", [row.id]);
      await client.query(`update auth_refresh_sessions set revoked_at=coalesce(revoked_at,now())
        where user_id=$1`, [row.user_id]);
      await client.query(`insert into platform_admin_audit_logs (action,target_type,target_id,reason,details)
        values ('admin.password_reset.complete','admin',$1,'Password reset by email link',jsonb_build_object('email',$2::text))`, [row.user_id, row.email]);
      await client.query("commit");
      return reply.send({ ok: true });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally { client.release(); }
  };
  const get_api_admin_bootstrap_status = async (request, reply) => {
        if (!app.db) {
            return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        }
        const count = await app.db.query(`select count(*)::int as count,
          exists(select 1 from app_admins a join app_users u on u.id=a.user_id
            where a.active=true and lower(u.email)=$1) as bootstrap_admin_exists
          from app_admins where active = true`, [normalizeEmail(env.adminBootstrapEmail ?? "")]);
        const localBootstrap = env.nodeEnv !== "production" && isLoopback(request.ip);
        const secureBootstrap = env.nodeEnv === "production" && !!env.adminBootstrapToken;
        const canRecoverConfiguredAdmin = secureBootstrap && !!env.adminBootstrapEmail && count.rows[0].bootstrap_admin_exists;
        return reply.send({
            ok: true,
            canBootstrap: canRecoverConfiguredAdmin || (count.rows[0].count === 0 && (localBootstrap || secureBootstrap)),
            requiresBootstrapToken: !!env.adminBootstrapToken,
        });
    };
  const post_api_admin_bootstrap = async (request, reply) => {
        const suppliedToken = typeof request.body?.bootstrapToken === "string" ? request.body.bootstrapToken : "";
        const tokenConfigured = !!env.adminBootstrapToken;
        const tokenValid = tokenConfigured && safeTokenEquals(env.adminBootstrapToken, suppliedToken);
        const localBootstrap = env.nodeEnv !== "production" && isLoopback(request.ip);
        if (!app.db || (tokenConfigured ? !tokenValid : !localBootstrap)) {
            return reply.status(403).send({ ok: false, error: "BOOTSTRAP_FORBIDDEN" });
        }
        const email = normalizeEmail(request.body?.email ?? "");
        const password = request.body?.password ?? "";
        if (!isValidEmail(email)) {
            return reply.status(400).send({ ok: false, error: "INVALID_EMAIL" });
        }
        const configuredBootstrapEmail = normalizeEmail(env.adminBootstrapEmail ?? "");
        if (tokenConfigured && configuredBootstrapEmail && email !== configuredBootstrapEmail) {
            return reply.status(403).send({ ok: false, error: "BOOTSTRAP_EMAIL_MISMATCH" });
        }
        if (password.length < 6 || password.length > 200) {
            return reply
                .status(400)
                .send({ ok: false, error: "ADMIN_PASSWORD_TOO_SHORT" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            await client.query("select pg_advisory_xact_lock(hashtext('shopqr:admin-bootstrap'))");
            const existingAdmin = await client.query("select 1 from app_admins where active = true limit 1");
            const targetIsActiveAdmin = existingAdmin.rows[0] && tokenValid && configuredBootstrapEmail
                ? (await client.query(`select 1 from app_admins a join app_users u on u.id=a.user_id
                    where a.active=true and lower(u.email)=$1 limit 1`, [configuredBootstrapEmail])).rows[0]
                : null;
            if (existingAdmin.rows[0] && !targetIsActiveAdmin) {
                await client.query("rollback");
                return reply.status(409).send({ ok: false, error: "ADMIN_ALREADY_EXISTS" });
            }
            const existingUser = await client.query("select id from app_users where lower(email) = $1 for update", [email]);
            let userId = existingUser.rows[0]?.id;
            if (userId) {
                await client.query(`update app_users set password_hash = $2,
               password_migrated_at = coalesce(password_migrated_at, now()),
               disabled_at = null, disabled_reason = null, updated_at = now()
             where id = $1`, [userId, await hashPassword(password)]);
            }
            else {
                const created = await client.query(`insert into app_users
              (email, password_hash, password_migrated_at, email_verified_at)
             values ($1, $2, now(), now())
             returning id`, [email, await hashPassword(password)]);
                userId = created.rows[0].id;
            }
            await client.query(`insert into app_admins (user_id, role, active)
           values ($1, 'super_admin', true)
           on conflict (user_id) do update set role='super_admin', active=true, updated_at=now()`, [userId]);
            await client.query("commit");
            return reply.status(201).send({ ok: true });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
  const post_api_admin_auth_login = async (request, reply) => {
        if (!app.db || !env.authJwtSecret) {
            return reply.status(503).send({ ok: false, error: "AUTH_NOT_CONFIGURED" });
        }
        const email = normalizeEmail(request.body?.email ?? "");
        const password = request.body?.password ?? "";
        const result = await app.db.query(`select u.id, u.email, u.password_hash, u.disabled_at,
                a.role, a.active
         from app_users u
         left join app_admins a on a.user_id = u.id
         where lower(u.email) = $1
         limit 1`, [email]);
        const row = result.rows[0];
        if (!row ||
            !row.password_hash ||
            row.disabled_at ||
            !row.active ||
            !(await verifyPassword(row.password_hash, password))) {
            await recordLoginFailure(app.db, email, row?.id ?? null);
            return reply.status(401).send({ ok: false, error: "INVALID_CREDENTIALS" });
        }
        const user = { id: row.id, email: row.email };
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const session = await createRefreshSession(client, user.id, request, env);
            const accessToken = await signAccessToken(env, user);
            await client.query("update app_users set last_login_at = now() where id = $1", [user.id]);
            await clearLoginFailures(client, email);
            await writeAdminAudit(client, request.ip, {
                admin: { user, role: row.role },
                action: "admin.login",
                targetType: "admin",
                targetId: user.id,
                reason: null,
                details: {},
            });
            await client.query("commit");
            setRefreshCookie(reply, session, env);
            return reply.send({
                ok: true,
                accessToken,
                user,
                adminRole: row.role,
            });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
  const get_api_admin_me = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        return reply.send({ ok: true, user: admin.user, adminRole: admin.role });
    };
  const get_api_admin_summary = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        let result;
        try {
          result = await app.db.query(`with users_activity as (
          select u.id, coalesce(nullif(u.display_name, ''), u.email) as display_name,
                 u.email,
                 coalesce(
                   nullif(to_jsonb(u)->>'last_activity_at', '')::timestamptz,
                   u.last_login_at,
                   (select max(coalesce(s.last_used_at, s.created_at))
                      from auth_refresh_sessions s where s.user_id = u.id),
                   u.created_at
                 ) as last_activity_at,
                 to_jsonb(u) ? 'last_activity_at' as tracking_ready,
                 u.disabled_at, u.disabled_reason,
                 coalesce(string_agg(distinct r.name, ' · ' order by r.name)
                   filter (where r.name is not null), '') as restaurant_names
          from app_users u
          left join restaurant_members m on m.user_id = u.id
          left join restaurants r on r.id = m.restaurant_id
          where not exists (
            select 1 from app_admins a where a.user_id = u.id and a.active = true
          )
          group by u.id
        )
        select
         (select count(*) from restaurants)::int as restaurant_count,
         (select count(*) from restaurants where suspended_at is not null)::int as suspended_restaurant_count,
         (select count(*) from app_users)::int as user_count,
         (select count(*) from app_users where password_hash is not null)::int as migrated_user_count,
         (select count(*) from app_users where password_hash is null)::int as pending_migration_count,
         (select count(*) from app_users where disabled_at is not null)::int as disabled_user_count,
         (select count(*) from orders where created_at >= current_date)::int as today_order_count,
         coalesce((select sum(total) from orders
           where paid = true and paid_at >= current_date), 0)::text as today_revenue,
         (select max(created_at) from orders) as last_order_at,
         jsonb_build_object(
           'trackingReady', (select coalesce(bool_and(tracking_ready), true) from users_activity),
           'onlineCount', (select count(*)::int from users_activity
             where disabled_at is null and last_activity_at >= now() - interval '5 minutes'),
           'onlineAccounts', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'name', display_name, 'email', email,
               'restaurants', restaurant_names, 'lastActivityAt', last_activity_at))
             from (select * from users_activity where disabled_at is null
               and last_activity_at >= now() - interval '5 minutes'
               order by last_activity_at desc limit 6) recent), '[]'::jsonb),
           'recentlyAwayCount', (select count(*)::int from users_activity
             where disabled_at is null
               and last_activity_at < now() - interval '5 minutes'
               and last_activity_at >= now() - interval '1 hour'),
           'pausedCount', (select count(*)::int from users_activity
             where disabled_at is null and last_activity_at < now() - interval '1 hour'
               and last_activity_at >= now() - interval '3 days'),
           'pausedAccounts', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'name', display_name, 'email', email,
               'restaurants', restaurant_names, 'lastActivityAt', last_activity_at))
             from (select * from users_activity where disabled_at is null
               and last_activity_at < now() - interval '1 hour'
               and last_activity_at >= now() - interval '3 days'
               order by last_activity_at desc limit 6) recent), '[]'::jsonb),
           'inactiveCount', (select count(*)::int from users_activity
             where disabled_at is null and last_activity_at < now() - interval '3 days'),
           'inactiveAccounts', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'name', display_name, 'email', email,
               'restaurants', restaurant_names, 'lastActivityAt', last_activity_at))
             from (select * from users_activity where disabled_at is null
               and last_activity_at < now() - interval '3 days'
               order by last_activity_at asc limit 6) recent), '[]'::jsonb),
           'suspendedInactiveCount', (select count(*)::int from users_activity
             where disabled_reason = 'AUTOMATIC_INACTIVITY_365_DAYS'),
           'suspendedInactiveAccounts', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'name', display_name, 'email', email,
               'restaurants', restaurant_names, 'lastActivityAt', last_activity_at))
             from (select * from users_activity
               where disabled_reason = 'AUTOMATIC_INACTIVITY_365_DAYS'
               order by last_activity_at asc limit 6) recent), '[]'::jsonb)
         ) as activity`);
        } catch (error) {
            request.log.error({ err: error }, "Could not load account activity summary; serving the base overview");
            const fallback = await app.db.query(`select
             (select count(*) from restaurants)::int as restaurant_count,
             (select count(*) from restaurants where suspended_at is not null)::int as suspended_restaurant_count,
             (select count(*) from app_users)::int as user_count,
             (select count(*) from app_users where password_hash is not null)::int as migrated_user_count,
             (select count(*) from app_users where password_hash is null)::int as pending_migration_count,
             (select count(*) from app_users where disabled_at is not null)::int as disabled_user_count,
             (select count(*) from orders where created_at >= current_date)::int as today_order_count,
             coalesce((select sum(total) from orders where paid = true and paid_at >= current_date), 0)::text as today_revenue,
             (select max(created_at) from orders) as last_order_at`);
            const row = fallback.rows[0];
            return reply.send({ ok: true, summary: {
                ...row,
                today_revenue: Number(row.today_revenue),
                activity: {
                    trackingReady: false,
                    onlineCount: 0, onlineAccounts: [], recentlyAwayCount: 0,
                    pausedCount: 0, pausedAccounts: [], inactiveCount: 0, inactiveAccounts: [],
                    suspendedInactiveCount: 0, suspendedInactiveAccounts: [],
                },
            } });
        }
        const row = result.rows[0];
        return reply.send({
            ok: true,
            summary: {
                ...row,
                today_revenue: Number(row.today_revenue),
            },
        });
    };
  const get_api_admin_restaurants = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        const search = request.query.search?.trim() ?? "";
        const status = request.query.status ?? "all";
        if (!["all", "active", "suspended", "migration_pending"].includes(status)) {
            return reply.status(400).send({ ok: false, error: "INVALID_FILTER" });
        }
        const limit = clampInteger(request.query.limit, 50, 1, 100);
        const offset = clampInteger(request.query.offset, 0, 0, 100_000);
        let result;
        try {
          result = await app.db.query(`with clock as (
         select clock_timestamp() as server_now
       )
       select r.id, r.name, r.accepting_orders, r.suspended_at,
              r.suspension_reason, r.created_at, r.currency_code,
              clock.server_now,
              greatest(paid.expires_at, trial.expires_at) as pro_expires_at,
              coalesce(trial.expires_at > clock.server_now and
                (paid.expires_at is null or trial.expires_at >= paid.expires_at), false) as trial_active,
              exists(select 1 from pro_requests pending
                where pending.restaurant_id = r.id and pending.status = 'pending') as pro_request_pending,
              owner.email as owner_email,
              (select count(*) from restaurant_members m
                where m.restaurant_id = r.id)::int as member_count,
              (select count(*) from restaurant_members m
                join app_users u on u.id = m.user_id
                where m.restaurant_id = r.id
                  and u.password_hash is not null)::int as migrated_member_count,
              (select count(*) from menus me
                where me.restaurant_id = r.id)::int as menu_count,
              (select count(*) from tables t
                where t.restaurant_id = r.id)::int as table_count,
              (select count(*) from orders o
                where o.restaurant_id = r.id)::int as order_count,
              coalesce((select sum(o.total) from orders o
                where o.restaurant_id = r.id and o.paid = true
                  and o.paid_at >= current_date), 0)::text as today_revenue,
              (select max(o.created_at) from orders o
                where o.restaurant_id = r.id) as last_order_at
       from restaurants r
       cross join clock
       left join app_users owner on owner.id = r.user_id
       left join lateral (
         select max(p.reviewed_at + (p.paid_months + p.free_months) * interval '30 days') as expires_at
         from pro_requests p where p.restaurant_id = r.id and p.status = 'approved'
       ) paid on true
       left join restaurant_pro_trials trial on trial.restaurant_id = r.id
       where ($1 = '' or r.name ilike '%' || $1 || '%'
              or owner.email ilike '%' || $1 || '%')
         and ($2 = 'all'
           or ($2 = 'active' and r.suspended_at is null)
           or ($2 = 'suspended' and r.suspended_at is not null)
           or ($2 = 'migration_pending' and exists (
             select 1 from restaurant_members pm
             join app_users pu on pu.id = pm.user_id
             where pm.restaurant_id = r.id and pu.password_hash is null
           )))
       order by r.created_at desc
       limit $3 offset $4`, [search, status, limit, offset]);
        } catch (error) {
          // Keep shop management usable on databases that have not applied
          // migration 0040 yet. Trial expiry data becomes available once it is applied.
          const databaseError = error as { code?: string; message?: string };
          if (databaseError.code !== "42P01" || !databaseError.message?.includes("restaurant_pro_trials")) {
            throw error;
          }
          result = await app.db.query(`with clock as (
         select clock_timestamp() as server_now
       )
       select r.id, r.name, r.accepting_orders, r.suspended_at,
              r.suspension_reason, r.created_at, r.currency_code,
              clock.server_now,
              paid.expires_at as pro_expires_at,
              false as trial_active,
              exists(select 1 from pro_requests pending
                where pending.restaurant_id = r.id and pending.status = 'pending') as pro_request_pending,
              owner.email as owner_email,
              (select count(*) from restaurant_members m
                where m.restaurant_id = r.id)::int as member_count,
              (select count(*) from restaurant_members m
                join app_users u on u.id = m.user_id
                where m.restaurant_id = r.id
                  and u.password_hash is not null)::int as migrated_member_count,
              (select count(*) from menus me
                where me.restaurant_id = r.id)::int as menu_count,
              (select count(*) from tables t
                where t.restaurant_id = r.id)::int as table_count,
              (select count(*) from orders o
                where o.restaurant_id = r.id)::int as order_count,
              coalesce((select sum(o.total) from orders o
                where o.restaurant_id = r.id and o.paid = true
                  and o.paid_at >= current_date), 0)::text as today_revenue,
              (select max(o.created_at) from orders o
                where o.restaurant_id = r.id) as last_order_at
       from restaurants r
       cross join clock
       left join app_users owner on owner.id = r.user_id
       left join lateral (
         select max(p.reviewed_at + (p.paid_months + p.free_months) * interval '30 days') as expires_at
         from pro_requests p where p.restaurant_id = r.id and p.status = 'approved'
       ) paid on true
       where ($1 = '' or r.name ilike '%' || $1 || '%'
              or owner.email ilike '%' || $1 || '%')
         and ($2 = 'all'
           or ($2 = 'active' and r.suspended_at is null)
           or ($2 = 'suspended' and r.suspended_at is not null)
           or ($2 = 'migration_pending' and exists (
             select 1 from restaurant_members pm
             join app_users pu on pu.id = pm.user_id
             where pm.restaurant_id = r.id and pu.password_hash is null
           )))
       order by r.created_at desc
       limit $3 offset $4`, [search, status, limit, offset]);
        }
        return reply.send({ ok: true, restaurants: result.rows });
    };
  const get_api_admin_restaurants_restaurantId = async (request, reply) => {
        if (!isUuid(request.params.restaurantId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        const restaurantId = request.params.restaurantId;
        const restaurantResult = await app.db.query(`select r.id, r.name, r.accepting_orders, r.open_time, r.close_time,
              r.service_charge_pct::text, r.vat_pct::text, r.payment_qr_url,
              r.kitchen_print_width, r.suspended_at, r.suspension_reason,
              r.created_at, r.updated_at, owner.email as owner_email,
              owner.phone as owner_phone
       from restaurants r
       left join app_users owner on owner.id = r.user_id
       where r.id = $1`, [restaurantId]);
        if (!restaurantResult.rows[0]) {
            return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
        }
        const [metricsResult, dailyResult, statusResult, paymentResult, membersResult, recentOrdersResult, lowStockResult, auditResult,] = await Promise.all([
            app.db.query(`select
           (select count(*) from restaurant_members where restaurant_id = $1)::int as member_count,
           (select count(*) from restaurant_members m join app_users u on u.id = m.user_id
              where m.restaurant_id = $1 and u.password_hash is not null)::int as migrated_member_count,
           (select count(*) from menus where restaurant_id = $1)::int as menu_count,
           (select count(*) from menus where restaurant_id = $1 and available = true)::int as available_menu_count,
           (select count(*) from tables where restaurant_id = $1)::int as table_count,
           (select count(*) from tables where restaurant_id = $1 and is_open = true)::int as open_table_count,
           (select count(*) from inventory_items where restaurant_id = $1 and active = true)::int as inventory_item_count,
           (select count(*) from promotions where restaurant_id = $1 and active = true)::int as promotion_count,
           (select count(*) from orders where restaurant_id = $1 and created_at >= current_date)::int as today_order_count,
           coalesce((select sum(total) from orders where restaurant_id = $1
             and paid = true and paid_at >= current_date), 0)::text as today_revenue,
           (select count(*) from orders where restaurant_id = $1
             and created_at >= current_date - interval '29 days')::int as last_30_order_count,
           coalesce((select sum(total) from orders where restaurant_id = $1
             and paid = true and paid_at >= current_date - interval '29 days'), 0)::text as last_30_revenue`, [restaurantId]),
            app.db.query(`select to_char(day, 'YYYY-MM-DD') as day,
                count(o.id)::int as order_count,
                coalesce(sum(o.total) filter (where o.paid = true), 0)::text as revenue
         from generate_series(
           current_date - interval '29 days',
           current_date,
           interval '1 day'
         ) day
         left join orders o on o.restaurant_id = $1
           and o.created_at >= day and o.created_at < day + interval '1 day'
         group by day
         order by day`, [restaurantId]),
            app.db.query(`select status::text, count(*)::int as count
         from orders where restaurant_id = $1
           and created_at >= current_date - interval '29 days'
         group by status order by count(*) desc`, [restaurantId]),
            app.db.query(`select coalesce(nullif(payment_method, ''), 'ไม่ระบุ') as method,
                count(*)::int as count, coalesce(sum(total), 0)::text as revenue
         from orders where restaurant_id = $1 and paid = true
           and paid_at >= current_date - interval '29 days'
         group by coalesce(nullif(payment_method, ''), 'ไม่ระบุ')
         order by sum(total) desc`, [restaurantId]),
            app.db.query(`select u.id, u.email, u.phone, u.display_name, m.role::text,
                u.password_migrated_at, u.last_login_at, u.disabled_at,
                u.disabled_reason, m.created_at
         from restaurant_members m
         join app_users u on u.id = m.user_id
         where m.restaurant_id = $1
         order by case m.role when 'owner' then 0 else 1 end, m.created_at`, [restaurantId]),
            app.db.query(`select o.id, t.table_number, z.name as zone_name, o.status::text,
                o.total::text, o.paid, o.payment_method, o.created_at
         from orders o
         join tables t on t.id = o.table_id
         left join table_zones z on z.id = t.zone_id
         where o.restaurant_id = $1
         order by o.created_at desc
         limit 30`, [restaurantId]),
            app.db.query(`select i.id, i.name, i.sku, i.unit, i.minimum_stock::text,
                coalesce(sum(b.quantity), 0)::text as quantity
         from inventory_items i
         left join inventory_balances b on b.inventory_item_id = i.id
         where i.restaurant_id = $1 and i.active = true and i.track_stock = true
         group by i.id
         having coalesce(sum(b.quantity), 0) <= i.minimum_stock
         order by coalesce(sum(b.quantity), 0), i.name
         limit 30`, [restaurantId]),
            app.db.query(`select id, action, actor_email, reason, details, source, created_at
         from (
           select l.id, l.action, u.email as actor_email, null::text as reason,
                  l.details, 'restaurant'::text as source, l.created_at
           from audit_logs l
           left join app_users u on u.id = l.actor_user_id
           where l.restaurant_id = $1
           union all
           select l.id, l.action, u.email as actor_email, l.reason,
                  l.details, 'platform'::text as source, l.created_at
           from platform_admin_audit_logs l
           left join app_users u on u.id = l.admin_user_id
           where l.restaurant_id = $1
         ) activity
         order by created_at desc
         limit 50`, [restaurantId]),
        ]);
        const metrics = metricsResult.rows[0];
        return reply.send({
            ok: true,
            restaurant: {
                ...restaurantResult.rows[0],
                service_charge_pct: Number(restaurantResult.rows[0].service_charge_pct),
                vat_pct: Number(restaurantResult.rows[0].vat_pct),
            },
            metrics: {
                ...metrics,
                today_revenue: Number(metrics.today_revenue),
                last_30_revenue: Number(metrics.last_30_revenue),
            },
            daily: dailyResult.rows.map((row) => ({
                ...row,
                revenue: Number(row.revenue),
            })),
            orderStatuses: statusResult.rows,
            paymentMethods: paymentResult.rows.map((row) => ({
                ...row,
                revenue: Number(row.revenue),
            })),
            members: membersResult.rows,
            recentOrders: recentOrdersResult.rows.map((row) => ({
                ...row,
                total: Number(row.total),
            })),
            lowStock: lowStockResult.rows.map((row) => ({
                ...row,
                minimum_stock: Number(row.minimum_stock),
                quantity: Number(row.quantity),
            })),
            recentAudit: auditResult.rows,
        });
    };
  const get_api_admin_users = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        const restaurantId = request.query.restaurantId ?? null;
        if (restaurantId && !isUuid(restaurantId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const migration = request.query.migration ?? "all";
        if (!["all", "complete", "pending"].includes(migration)) {
            return reply.status(400).send({ ok: false, error: "INVALID_FILTER" });
        }
        const search = request.query.search?.trim() ?? "";
        const limit = clampInteger(request.query.limit, 100, 1, 200);
        const offset = clampInteger(request.query.offset, 0, 0, 100_000);
        const result = await app.db.query(`select u.id, u.email, u.phone, u.display_name, u.disabled_at,
              u.disabled_reason, u.password_migrated_at, u.last_login_at,
              coalesce((select f.failed_count from app_login_failures f
                where f.identifier_hash = encode(digest(lower(btrim(u.email)), 'sha256'), 'hex')), 0)::bigint
                as failed_login_attempts,
              coalesce((select f.failed_count from app_login_failures f
                where f.identifier_hash = '__unknown_username__'), 0)::bigint
                as unmatched_login_attempts,
              u.created_at, m.restaurant_id, r.name as restaurant_name,
              m.role as restaurant_role,
              exists(select 1 from app_admins a
                where a.user_id = u.id and a.active = true) as is_admin
       from app_users u
       left join restaurant_members m on m.user_id = u.id
       left join restaurants r on r.id = m.restaurant_id
       where ($1::uuid is null or m.restaurant_id = $1)
         and ($2 = '' or u.email ilike '%' || $2 || '%'
              or coalesce(u.phone, '') ilike '%' || $2 || '%')
         and ($3 = 'all'
           or ($3 = 'complete' and u.password_hash is not null)
           or ($3 = 'pending' and u.password_hash is null))
       order by u.created_at desc
       limit $4 offset $5`, [restaurantId, search, migration, limit, offset]);
        return reply.send({ ok: true, users: result.rows });
    };
  const get_api_admin_users_userId = async (request, reply) => {
        if (!isUuid(request.params.userId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        const userId = request.params.userId;
        const userResult = await app.db.query(`select u.id, u.email, u.phone, u.phone_normalized, u.display_name,
              u.email_verified_at, u.password_migrated_at, u.last_login_at, u.last_activity_at,
              u.disabled_at, u.disabled_reason, u.created_at, u.updated_at,
              a.role as admin_role, a.active as admin_active
       from app_users u
       left join app_admins a on a.user_id = u.id
       where u.id = $1`, [userId]);
        if (!userResult.rows[0]) {
            return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
        }
        const [membershipsResult, sessionsResult, resetsResult, activityResult, metricsResult] = await Promise.all([
            app.db.query(`select m.id, m.role::text, m.created_at, r.id as restaurant_id,
                  r.name as restaurant_name, r.suspended_at,
                  (select count(*) from orders o where o.restaurant_id = r.id)::int as restaurant_order_count
           from restaurant_members m
           join restaurants r on r.id = m.restaurant_id
           where m.user_id = $1
           order by m.created_at`, [userId]),
            app.db.query(`select id, expires_at, revoked_at, replaced_by, user_agent,
                  host(ip_address) as ip_address, created_at, last_used_at,
                  (revoked_at is null and expires_at > now()) as active
           from auth_refresh_sessions
           where user_id = $1
           order by created_at desc
           limit 30`, [userId]),
            app.db.query(`select t.id, t.expires_at, t.used_at, t.created_at,
                  t.requested_reason, a.email as created_by_admin_email,
                  (t.used_at is null and t.expires_at > now()) as active
           from password_reset_tokens t
           left join app_users a on a.id = t.created_by_admin
           where t.user_id = $1
           order by t.created_at desc
           limit 30`, [userId]),
            app.db.query(`select id, action, actor_email, restaurant_name, reason, source, created_at
           from (
             select l.id, l.action, actor.email as actor_email,
                    r.name as restaurant_name, null::text as reason,
                    'restaurant'::text as source, l.created_at
             from audit_logs l
             left join app_users actor on actor.id = l.actor_user_id
             left join restaurants r on r.id = l.restaurant_id
             where l.actor_user_id = $1 or l.target_id = $1
             union all
             select l.id, l.action, actor.email as actor_email,
                    r.name as restaurant_name, l.reason,
                    'platform'::text as source, l.created_at
             from platform_admin_audit_logs l
             left join app_users actor on actor.id = l.admin_user_id
             left join restaurants r on r.id = l.restaurant_id
             where l.target_id = $1 or l.admin_user_id = $1
           ) activity
           order by created_at desc
           limit 50`, [userId]),
            app.db.query(`select
             (select count(*) from restaurant_members where user_id = $1)::int as membership_count,
             (select count(*) from auth_refresh_sessions where user_id = $1
                and revoked_at is null and expires_at > now())::int as active_session_count,
             (select count(*) from password_reset_tokens where user_id = $1)::int as password_reset_count,
             (select count(*) from audit_logs where actor_user_id = $1)::int as restaurant_activity_count,
             (select count(*) from platform_admin_audit_logs
                where target_id = $1 or admin_user_id = $1)::int as platform_activity_count`, [userId]),
        ]);
        return reply.send({
            ok: true,
            user: userResult.rows[0],
            metrics: metricsResult.rows[0],
            memberships: membershipsResult.rows,
            sessions: sessionsResult.rows,
            passwordResets: resetsResult.rows,
            recentActivity: activityResult.rows,
        });
    };
  const patch_api_admin_restaurants_restaurantId_status = async (request, reply) => {
        if (!isUuid(request.params.restaurantId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const admin = await requirePlatformAdmin(request, reply, env, [
            "super_admin",
            "support",
        ]);
        if (!admin)
            return;
        const suspended = request.body?.suspended;
        const reason = request.body?.reason?.trim() ?? "";
        if (typeof suspended !== "boolean" || (suspended && reason.length < 3) || reason.length > 500) {
            return reply.status(400).send({ ok: false, error: "REASON_REQUIRED" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const result = await client.query(`update restaurants set suspended_at = case when $2 then now() else null end,
           suspension_reason = case when $2 then $3 else null end
         where id = $1
         returning id, name, suspended_at, suspension_reason`, [request.params.restaurantId, suspended, reason || null]);
            if (!result.rows[0]) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
            }
            await writeAdminAudit(client, request.ip, {
                admin,
                action: suspended ? "restaurant.suspend" : "restaurant.restore",
                targetType: "restaurant",
                targetId: request.params.restaurantId,
                restaurantId: request.params.restaurantId,
                reason: reason || null,
                details: {},
            });
            await client.query("commit");
            return reply.send({ ok: true, restaurant: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
  const patch_api_admin_users_userId_status = async (request, reply) => {
        if (!isUuid(request.params.userId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const admin = await requirePlatformAdmin(request, reply, env, [
            "super_admin",
            "support",
        ]);
        if (!admin)
            return;
        const disabled = request.body?.disabled;
        const reason = request.body?.reason?.trim() ?? "";
        if (typeof disabled !== "boolean" ||
            (disabled && reason.length < 3) ||
            reason.length > 500 ||
            (disabled && request.params.userId === admin.user.id)) {
            return reply.status(400).send({ ok: false, error: "INVALID_STATUS_CHANGE" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const result = await client.query(`update app_users set
           disabled_at = case when $2 then now() else null end,
           disabled_reason = case when $2 then $3 else null end,
           last_activity_at = case when $2 then last_activity_at else now() end
         where id = $1 returning id, email, disabled_at, disabled_reason`, [request.params.userId, disabled, reason || null]);
            if (!result.rows[0]) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
            }
            if (disabled) {
                await client.query(`update auth_refresh_sessions
           set revoked_at = coalesce(revoked_at, now())
           where user_id = $1`, [request.params.userId]);
            }
            await writeAdminAudit(client, request.ip, {
                admin,
                action: disabled ? "user.disable" : "user.enable",
                targetType: "user",
                targetId: request.params.userId,
                reason: reason || null,
                details: { email: result.rows[0].email },
            });
            await client.query("commit");
            return reply.send({ ok: true, user: result.rows[0] });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
  const post_api_admin_users_userId_password_reset_link = async (request, reply) => {
        if (!isUuid(request.params.userId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const admin = await requirePlatformAdmin(request, reply, env, [
            "super_admin",
            "support",
        ]);
        if (!admin)
            return;
        const reason = request.body?.reason?.trim() ?? "";
        if (reason.length < 3 || reason.length > 500) {
            return reply.status(400).send({ ok: false, error: "REASON_REQUIRED" });
        }
        const rawToken = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const user = await client.query("select id, email from app_users where id = $1 and disabled_at is null for update", [request.params.userId]);
            if (!user.rows[0]) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
            }
            await client.query(`update password_reset_tokens set used_at = coalesce(used_at, now())
         where user_id = $1 and used_at is null`, [request.params.userId]);
            await client.query(`insert into password_reset_tokens
          (user_id, token_hash, expires_at, created_by_admin, requested_reason)
         values ($1, $2, $3, $4, $5)`, [
                request.params.userId,
                createHash("sha256").update(rawToken).digest(),
                expiresAt,
                admin.user.id,
                reason,
            ]);
            await writeAdminAudit(client, request.ip, {
                admin,
                action: "user.password_reset_link.create",
                targetType: "user",
                targetId: request.params.userId,
                reason,
                details: { email: user.rows[0].email, expires_at: expiresAt.toISOString() },
            });
            await client.query("commit");
            return reply.send({
                ok: true,
                resetToken: rawToken,
                expiresAt,
                email: user.rows[0].email,
            });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
  const post_api_admin_users_userId_set_password = async (request, reply) => {
        if (!isUuid(request.params.userId)) {
            return reply.status(400).send({ ok: false, error: "INVALID_ID" });
        }
        const admin = await requirePlatformAdmin(request, reply, env, [
            "super_admin",
            "support",
        ]);
        if (!admin)
            return;
        const newPassword = request.body?.newPassword ?? "";
        const reason = request.body?.reason?.trim() || "Admin direct password update";
        if (newPassword.length < 6 || newPassword.length > 200) {
            return reply.status(400).send({ ok: false, error: "PASSWORD_TOO_SHORT" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const user = await client.query("select id, email from app_users where id = $1 and disabled_at is null for update", [request.params.userId]);
            if (!user.rows[0]) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
            }
            const hashedPassword = await hashPassword(newPassword);
            await client.query(`update app_users set password_hash = $2,
           password_migrated_at = coalesce(password_migrated_at, now()),
           updated_at = now()
         where id = $1`, [request.params.userId, hashedPassword]);
            await client.query("update auth_refresh_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1 and revoked_at is null", [request.params.userId]);
            await writeAdminAudit(client, request.ip, {
                admin,
                action: "user.password.direct_set",
                targetType: "user",
                targetId: request.params.userId,
                reason,
                details: { email: user.rows[0].email },
            });
            await client.query("commit");
            return reply.send({
                ok: true,
                email: user.rows[0].email,
            });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
  const get_api_admin_audit_logs = async (request, reply) => {
        const admin = await requirePlatformAdmin(request, reply, env);
        if (!admin)
            return;
        const limit = clampInteger(request.query.limit, 100, 1, 500);
        const offset = clampInteger(request.query.offset, 0, 0, 100_000);
        const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
        const action = typeof request.query.action === "string" ? request.query.action.trim() : "";
        const actor = typeof request.query.actor === "string" ? request.query.actor.trim() : "";
        const from = typeof request.query.from === "string" ? request.query.from : null;
        const to = typeof request.query.to === "string" ? request.query.to : null;
        const until = typeof request.query.until === "string" ? request.query.until : null;
        const isDateTime = (value) => !value || value.length <= 40 && !Number.isNaN(Date.parse(value));
        if (search.length > 200 || action.length > 100 || actor.length > 320 ||
            !isDateTime(from) || !isDateTime(to) ||
            (from && to && Date.parse(from) > Date.parse(to)) || !isDateTime(until)) {
            return reply.status(400).send({ ok: false, error: "INVALID_FILTER" });
        }
        const filters = [search, action, actor, from, to, until];
        const where = `where ($1 = '' or l.action ilike '%' || $1 || '%'
                    or coalesce(l.target_type, '') ilike '%' || $1 || '%'
                    or coalesce(l.target_id::text, '') ilike '%' || $1 || '%'
                    or coalesce(l.reason, '') ilike '%' || $1 || '%'
                    or coalesce(l.details::text, '') ilike '%' || $1 || '%'
                    or coalesce(l.ip_address::text, '') ilike '%' || $1 || '%'
                    or coalesce(u.email, '') ilike '%' || $1 || '%'
                    or coalesce(r.name, '') ilike '%' || $1 || '%')
         and ($2 = '' or l.action = $2)
         and ($3 = '' or coalesce(u.email, '') ilike '%' || $3 || '%')
         and ($4::timestamptz is null or l.created_at >= $4::timestamptz)
         and ($5::timestamptz is null or l.created_at < $5::timestamptz)
         and ($6::timestamptz is null or l.created_at <= $6::timestamptz)`;
        const joins = `from platform_admin_audit_logs l
         left join app_users u on u.id = l.admin_user_id
         left join restaurants r on r.id = l.restaurant_id`;
        const countResult = await app.db.query(`select count(*)::int as total ${joins} ${where}`, filters);
        const result = await app.db.query(`select l.id, l.action, l.target_type, l.target_id, l.restaurant_id,
              l.reason, l.details, l.ip_address, l.created_at,
              u.email as admin_email, r.name as restaurant_name
       ${joins}
       ${where}
       order by l.created_at desc
       limit $7 offset $8`, [...filters, limit, offset]);
        return reply.send({ ok: true, logs: result.rows, total: countResult.rows[0].total, limit, offset });
    };
  return { get_api_admin_bootstrap_status, post_api_admin_bootstrap, post_api_admin_auth_login, post_api_admin_auth_forgot_password, get_api_admin_auth_password_reset_token, post_api_admin_auth_reset_password, get_api_admin_me, get_api_admin_summary, get_api_admin_restaurants, get_api_admin_restaurants_restaurantId, get_api_admin_users, get_api_admin_users_userId, patch_api_admin_restaurants_restaurantId_status, patch_api_admin_users_userId_status, post_api_admin_users_userId_password_reset_link, post_api_admin_users_userId_set_password, get_api_admin_audit_logs };
}

async function writeAdminAudit(client, ipAddress, input) {
    await client.query(`insert into platform_admin_audit_logs
      (admin_user_id, action, target_type, target_id, restaurant_id,
       reason, details, ip_address)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [
        input.admin.user.id,
        input.action,
        input.targetType,
        input.targetId,
        input.restaurantId ?? null,
        input.reason,
        JSON.stringify(input.details),
        ipAddress || null,
    ]);
}
function clampInteger(raw, fallback, min, max) {
    const parsed = Number(raw ?? fallback);
    return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isLoopback(ip) {
    return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}
function isValidEmail(value) {
    return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isResetToken(value) {
    return /^[A-Za-z0-9_-]{40,60}$/.test(value);
}
function safeTokenEquals(expected, supplied) {
    const expectedBytes = Buffer.from(expected, "utf8");
    const suppliedBytes = Buffer.from(supplied, "utf8");
    return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
