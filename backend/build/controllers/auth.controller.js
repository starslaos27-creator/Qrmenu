import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { clearRefreshCookie, createRefreshSession, hashPassword, normalizeEmail, normalizePhone, REFRESH_COOKIE_NAME, requireAuth, revokeRefreshSession, rotateRefreshSession, setRefreshCookie, signAccessToken, validatePassword, verifyPassword, } from "../security/auth.js";
import { clearLoginFailures, recordLoginFailure } from "../security/login-failures.js";
export function createAuthController(app, env) {
    const post_api_auth_signup = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const email = normalizeEmail(request.body?.email ?? "");
        const password = request.body?.password ?? "";
        const restaurantName = request.body?.restaurantName?.trim() ?? "";
        const currencyCode = request.body?.currencyCode ?? "LAK";
        const phone = request.body?.phone?.trim() || null;
        const phoneNormalized = normalizePhone(phone);
        const inviteToken = request.body?.inviteToken?.trim() || null;
        if (!isValidEmail(email)) {
            return reply.status(400).send({ ok: false, error: "INVALID_EMAIL" });
        }
        const passwordError = validatePassword(password);
        if (passwordError) {
            return reply.status(400).send({ ok: false, error: passwordError });
        }
        if (!inviteToken && !restaurantName) {
            return reply
                .status(400)
                .send({ ok: false, error: "RESTAURANT_NAME_REQUIRED" });
        }
        if (!inviteToken && !["LAK", "THB", "USD"].includes(currencyCode)) {
            return reply.status(400).send({ ok: false, error: "INVALID_CURRENCY" });
        }
        const passwordHash = await hashPassword(password);
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const userResult = await client.query(`insert into app_users
            (email, password_hash, phone, phone_normalized, password_migrated_at)
           values ($1, $2, $3, $4, now())
           returning id, email`, [email, passwordHash, phone, phoneNormalized]);
            const user = userResult.rows[0];
            const membership = inviteToken
                ? await createInvitedMembership(client, user, inviteToken, phone)
                : await createOwnerRestaurant(client, user, restaurantName, phone, currencyCode);
            const session = await createRefreshSession(client, user.id, request, env);
            const accessToken = await signAccessToken(env, user);
            await client.query("commit");
            setRefreshCookie(reply, session, env);
            return reply.status(201).send({
                ok: true,
                accessToken,
                user,
                membership,
            });
        }
        catch (error) {
            await client.query("rollback");
            if (isUniqueViolation(error)) {
                return reply.status(409).send({ ok: false, error: "ACCOUNT_EXISTS" });
            }
            if (error instanceof AuthRouteError) {
                return reply.status(error.status).send({ ok: false, error: error.code });
            }
            request.log.error({ err: error }, "signup failed");
            return reply.status(500).send({ ok: false, error: "SIGNUP_FAILED" });
        }
        finally {
            client.release();
        }
    };
    const post_api_auth_login = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const email = normalizeEmail(request.body?.email ?? "");
        const password = request.body?.password ?? "";
        const result = await app.db.query(`select id, email, password_hash, disabled_at
         from app_users
         where lower(email) = $1
         limit 1`, [email]);
        const row = result.rows[0];
        let migratedPasswordHash = null;
        let passwordMatches = Boolean(row?.password_hash) && !row?.disabled_at
            ? await verifyPassword(row.password_hash, password)
            : false;
        // Supabase Admin APIs intentionally do not expose password hashes.
        // During the staged cutover, verify an imported account against
        // Supabase once, then store a fresh Argon2 hash locally. No Supabase
        // access or refresh token is returned to the browser.
        if (row && !row.password_hash && !row.disabled_at && env.supabaseUrl && env.supabaseAnonKey) {
            const legacyClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            });
            const legacy = await legacyClient.auth.signInWithPassword({
                email,
                password,
            });
            if (!legacy.error && legacy.data.user?.id === row.id) {
                passwordMatches = true;
                migratedPasswordHash = await hashPassword(password);
            }
        }
        if (!row || !passwordMatches) {
            await recordLoginFailure(app.db, email, row?.id ?? null);
            return reply
                .status(401)
                .send({ ok: false, error: "INVALID_CREDENTIALS" });
        }
        const user = { id: row.id, email: row.email };
        const client = await app.db.connect();
        try {
            await client.query("begin");
            if (migratedPasswordHash) {
                await client.query(`update app_users
             set password_hash = $2, password_migrated_at = now(),
                 last_login_at = now(), last_activity_at = now(), updated_at = now()
             where id = $1 and password_hash is null`, [user.id, migratedPasswordHash]);
            }
            else {
                await client.query("update app_users set last_login_at = now(), last_activity_at = now() where id = $1", [user.id]);
            }
            await clearLoginFailures(client, email);
            const session = await createRefreshSession(client, user.id, request, env);
            const accessToken = await signAccessToken(env, user);
            const membership = await loadPrimaryMembership(client, user.id);
            await client.query("commit");
            setRefreshCookie(reply, session, env);
            return reply.send({ ok: true, accessToken, user, membership });
        }
        catch (error) {
            await client.query("rollback");
            request.log.error({ err: error }, "login failed");
            return reply.status(500).send({ ok: false, error: "LOGIN_FAILED" });
        }
        finally {
            client.release();
        }
    };
    const post_api_auth_refresh = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const rawToken = request.cookies[REFRESH_COOKIE_NAME];
        if (!rawToken) {
            return reply.status(401).send({ ok: false, error: "UNAUTHORIZED" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const rotated = await rotateRefreshSession(client, rawToken, request, env);
            if (!rotated) {
                await client.query("rollback");
                return reply.status(401).send({ ok: false, error: "UNAUTHORIZED" });
            }
            const accessToken = await signAccessToken(env, rotated.user);
            const membership = await loadPrimaryMembership(client, rotated.user.id);
            await client.query("commit");
            setRefreshCookie(reply, rotated.session, env);
            return reply.send({
                ok: true,
                accessToken,
                user: rotated.user,
                membership,
            });
        }
        catch (error) {
            await client.query("rollback");
            request.log.error({ err: error }, "refresh failed");
            return reply.status(500).send({ ok: false, error: "REFRESH_FAILED" });
        }
        finally {
            client.release();
        }
    };
    const post_api_auth_logout = async (request, reply) => {
        const rawToken = request.cookies[REFRESH_COOKIE_NAME];
        if (app.db && rawToken) {
            const client = await app.db.connect();
            try {
                await revokeRefreshSession(client, rawToken);
            }
            finally {
                client.release();
            }
        }
        clearRefreshCookie(reply, env);
        return reply.send({ ok: true });
    };
    const get_api_auth_me = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const tokenUser = await requireAuth(request, reply, env);
        if (!tokenUser)
            return;
        const result = await app.db.query(`update app_users
         set last_activity_at = case
           when last_activity_at < now() - interval '1 minute' then now()
           else last_activity_at end
         where id = $1 and disabled_at is null
         returning id, email, phone, display_name, disabled_at`, [tokenUser.id]);
        const user = result.rows[0];
        if (!user || user.disabled_at) {
            return reply.status(401).send({ ok: false, error: "UNAUTHORIZED" });
        }
        const membership = await loadPrimaryMembership(app.db, user.id);
        return reply.send({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                displayName: user.display_name,
            },
            membership,
        });
    };
    const post_api_auth_activity = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const tokenUser = await requireAuth(request, reply, env);
        if (!tokenUser)
            return;
        let result;
        try {
            result = await app.db.query(`update app_users
             set last_activity_at = now()
             where id = $1 and disabled_at is null
             returning last_activity_at`, [tokenUser.id]);
        }
        catch (error) {
            if (isUndefinedColumn(error)) {
                return reply.status(202).send({ ok: true, trackingReady: false });
            }
            throw error;
        }
        if (!result.rows[0]) {
            return reply.status(401).send({ ok: false, error: "UNAUTHORIZED" });
        }
        return reply.send({ ok: true, lastActivityAt: result.rows[0].last_activity_at });
    };
    const post_api_auth_change_password = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const user = await requireAuth(request, reply, env);
        if (!user)
            return;
        const currentPassword = request.body?.currentPassword ?? "";
        const newPassword = request.body?.newPassword ?? "";
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return reply.status(400).send({ ok: false, error: passwordError });
        }
        const existing = await app.db.query("select password_hash from app_users where id = $1 and disabled_at is null", [user.id]);
        const hash = existing.rows[0]?.password_hash;
        if (!hash || !(await verifyPassword(hash, currentPassword))) {
            return reply
                .status(401)
                .send({ ok: false, error: "INVALID_CURRENT_PASSWORD" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            await client.query(`update app_users set password_hash = $2,
             password_migrated_at = coalesce(password_migrated_at, now()),
             updated_at = now()
           where id = $1`, [user.id, await hashPassword(newPassword)]);
            await client.query(`update auth_refresh_sessions set revoked_at = coalesce(revoked_at, now())
           where user_id = $1`, [user.id]);
            await client.query("commit");
            clearRefreshCookie(reply, env);
            return reply.send({ ok: true, reauthRequired: true });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    const get_api_auth_invites_token = async (request, reply) => {
        if (!app.db) {
            return reply
                .status(503)
                .send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        }
        const token = request.params.token?.trim();
        if (!token || token.length > 200) {
            return reply.status(400).send({ ok: false, error: "INVALID_INVITE" });
        }
        const result = await app.db.query(`select i.id, i.restaurant_id, r.name as restaurant_name, i.role,
                i.used_at, i.revoked_at
         from restaurant_invites i
         join restaurants r on r.id = i.restaurant_id
         where i.token = $1
         limit 1`, [token]);
        if (!result.rows[0]) {
            return reply.status(404).send({ ok: false, error: "INVITE_NOT_FOUND" });
        }
        return reply.send({ ok: true, invite: result.rows[0] });
    };
    const post_api_auth_accept_invite = async (request, reply) => {
        if (!isSelfHostedAuthReady(app, env, reply))
            return;
        const user = await requireAuth(request, reply, env);
        if (!user)
            return;
        const token = request.body?.token?.trim() ?? "";
        if (!token || token.length > 200) {
            return reply.status(400).send({ ok: false, error: "INVALID_INVITE" });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const membership = await createInvitedMembership(client, user, token, null);
            await client.query("commit");
            return reply.send({ ok: true, membership });
        }
        catch (error) {
            await client.query("rollback");
            if (error instanceof AuthRouteError) {
                return reply.status(error.status).send({ ok: false, error: error.code });
            }
            if (isUniqueViolation(error)) {
                return reply
                    .status(409)
                    .send({ ok: false, error: "ALREADY_A_MEMBER" });
            }
            throw error;
        }
        finally {
            client.release();
        }
    };
    const post_api_auth_forgot_password = async (_request, reply) => {
        return reply.status(503).send({
            ok: false,
            error: "PASSWORD_RESET_NOT_CONFIGURED",
        });
    };
    const get_api_auth_password_reset_token = async (request, reply) => {
        if (!app.db) {
            return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        }
        const token = request.params.token?.trim() ?? "";
        if (!isResetToken(token)) {
            return reply.status(400).send({ ok: false, error: "INVALID_RESET_TOKEN" });
        }
        const result = await app.db.query(`select u.email, t.expires_at
         from password_reset_tokens t
         join app_users u on u.id = t.user_id
         where t.token_hash = $1 and t.used_at is null
           and t.expires_at > now() and u.disabled_at is null
         limit 1`, [hashResetToken(token)]);
        const row = result.rows[0];
        if (!row) {
            return reply.status(404).send({ ok: false, error: "RESET_TOKEN_EXPIRED" });
        }
        return reply.send({
            ok: true,
            email: row.email,
            expiresAt: row.expires_at,
        });
    };
    const post_api_auth_reset_password = async (request, reply) => {
        if (!app.db) {
            return reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        }
        const token = request.body?.token?.trim() ?? "";
        const newPassword = request.body?.newPassword ?? "";
        if (!isResetToken(token)) {
            return reply.status(400).send({ ok: false, error: "INVALID_RESET_TOKEN" });
        }
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return reply.status(400).send({ ok: false, error: passwordError });
        }
        const client = await app.db.connect();
        try {
            await client.query("begin");
            const tokenResult = await client.query(`select t.id, t.user_id
         from password_reset_tokens t
         join app_users u on u.id = t.user_id
         where t.token_hash = $1 and t.used_at is null
           and t.expires_at > now() and u.disabled_at is null
         for update of t`, [hashResetToken(token)]);
            const row = tokenResult.rows[0];
            if (!row) {
                await client.query("rollback");
                return reply.status(404).send({ ok: false, error: "RESET_TOKEN_EXPIRED" });
            }
            await client.query(`update app_users set password_hash = $2,
           password_migrated_at = coalesce(password_migrated_at, now()),
           updated_at = now()
         where id = $1`, [row.user_id, await hashPassword(newPassword)]);
            await client.query("update password_reset_tokens set used_at = now() where id = $1", [row.id]);
            await client.query(`update auth_refresh_sessions set revoked_at = coalesce(revoked_at, now())
         where user_id = $1`, [row.user_id]);
            await client.query("commit");
            clearRefreshCookie(reply, env);
            return reply.send({ ok: true });
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
        finally {
            client.release();
        }
    };
    return { post_api_auth_signup, post_api_auth_login, post_api_auth_refresh, post_api_auth_logout, get_api_auth_me, post_api_auth_activity, post_api_auth_change_password, get_api_auth_invites_token, post_api_auth_accept_invite, post_api_auth_forgot_password, get_api_auth_password_reset_token, post_api_auth_reset_password };
}
async function createOwnerRestaurant(client, user, restaurantName, phone, currencyCode = "LAK") {
    const restaurant = await client.query(`insert into restaurants (user_id, name, currency_code)
     values ($1, $2, $3)
     returning id, name, currency_code`, [user.id, restaurantName, currencyCode]);
    const row = restaurant.rows[0];
    await client.query(`with trial_start as (select clock_timestamp() as starts_at)
      insert into restaurant_pro_trials (restaurant_id, starts_at, expires_at)
      select $1, starts_at, starts_at + interval '90 days' from trial_start`, [row.id]);
    await client.query(`insert into restaurant_members
      (restaurant_id, user_id, role, invited_email, phone)
     values ($1, $2, 'owner', $3, $4)`, [row.id, user.id, user.email, phone]);
    await client.query(`insert into table_zones (restaurant_id, name, sort_order)
     values ($1, 'Main', 0)`, [row.id]);
    await client.query(`insert into stock_locations (restaurant_id, name, is_default)
     values ($1, 'Main', true)`, [row.id]);
    await client.query(`insert into finance_settings (restaurant_id, config)
     values ($1, jsonb_build_object('currency', $2))`, [row.id, row.currency_code]);
    return {
        restaurant_id: row.id,
        restaurant_name: row.name,
        currency_code: row.currency_code,
        role: "owner",
    };
}
async function createInvitedMembership(client, user, token, phone) {
    const invite = await client.query(`select i.id, i.restaurant_id, r.name as restaurant_name, r.currency_code,
            i.role, i.used_at, i.revoked_at
     from restaurant_invites i
     join restaurants r on r.id = i.restaurant_id
     where i.token = $1
     for update of i`, [token]);
    const row = invite.rows[0];
    if (!row)
        throw new AuthRouteError(404, "INVITE_NOT_FOUND");
    if (row.used_at)
        throw new AuthRouteError(409, "INVITE_ALREADY_USED");
    if (row.revoked_at)
        throw new AuthRouteError(410, "INVITE_REVOKED");
    await client.query(`insert into restaurant_members
      (restaurant_id, user_id, role, invited_email, phone)
     values ($1, $2, $3, $4, $5)`, [row.restaurant_id, user.id, row.role, user.email, phone]);
    await client.query(`update restaurant_invites
     set used_by = $2, used_at = now()
     where id = $1`, [row.id, user.id]);
    return {
        restaurant_id: row.restaurant_id,
        restaurant_name: row.restaurant_name,
        currency_code: row.currency_code,
        role: row.role,
    };
}
async function loadPrimaryMembership(client, userId) {
    const result = await client.query(`select m.restaurant_id, r.name as restaurant_name, r.currency_code, m.role
     from restaurant_members m
     join restaurants r on r.id = m.restaurant_id
     where m.user_id = $1
     order by m.created_at
     limit 1`, [userId]);
    return result.rows[0] ?? null;
}
function isSelfHostedAuthReady(app, env, reply) {
    if (app.db && env.authJwtSecret)
        return true;
    void reply.status(503).send({ ok: false, error: "AUTH_NOT_CONFIGURED" });
    return false;
}
function isValidEmail(value) {
    return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isResetToken(value) {
    return /^[A-Za-z0-9_-]{32,200}$/.test(value);
}
function hashResetToken(value) {
    return createHash("sha256").update(value).digest();
}
function isUniqueViolation(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505");
}
function isUndefinedColumn(error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "42703";
}
class AuthRouteError extends Error {
    status;
    code;
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
