import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "argon2";
import { jwtVerify, SignJWT } from "jose";
const ACCESS_TOKEN_AUDIENCE = "shopqr-api";
export const REFRESH_COOKIE_NAME = "shopqr_refresh";
export function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
export function normalizePhone(value) {
    const normalized = value?.replace(/\D/g, "") ?? "";
    return normalized || null;
}
export function validatePassword(value) {
    if (value.length < 6)
        return "PASSWORD_TOO_SHORT";
    if (value.length > 200)
        return "PASSWORD_TOO_LONG";
    return null;
}
export async function hashPassword(password) {
    return hash(password, {
        type: 2,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
    });
}
export async function verifyPassword(passwordHash, password) {
    return verify(passwordHash, password).catch(() => false);
}
export async function signAccessToken(env, user) {
    const secret = requireJwtSecret(env);
    return new SignJWT({ email: user.email })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(user.id)
        .setIssuer(env.authIssuer)
        .setAudience(ACCESS_TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${env.authAccessTokenTtlMinutes}m`)
        .sign(secret);
}
export async function verifyAccessToken(env, token) {
    try {
        const { payload } = await jwtVerify(token, requireJwtSecret(env), {
            issuer: env.authIssuer,
            audience: ACCESS_TOKEN_AUDIENCE,
            algorithms: ["HS256"],
        });
        if (!payload.sub || typeof payload.email !== "string")
            return null;
        return { id: payload.sub, email: payload.email };
    }
    catch {
        return null;
    }
}
export async function requireAuth(request, reply, env) {
    const header = request.headers.authorization;
    const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
    const token = match?.[1]?.trim();
    if (!token) {
        await reply.status(401).send({ ok: false, error: "UNAUTHORIZED" });
        return null;
    }
    const user = await verifyAccessToken(env, token);
    if (!user) {
        await reply.status(401).send({ ok: false, error: "UNAUTHORIZED" });
        return null;
    }
    return user;
}
export async function createRefreshSession(client, userId, request, env) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + env.authRefreshTokenTtlDays * 24 * 60 * 60 * 1000);
    const result = await client.query(`insert into auth_refresh_sessions
      (user_id, token_hash, expires_at, user_agent, ip_address)
     values ($1, $2, $3, $4, $5)
     returning id`, [
        userId,
        tokenHash,
        expiresAt,
        request.headers["user-agent"] ?? null,
        request.ip || null,
    ]);
    return { rawToken, id: result.rows[0].id, expiresAt };
}
export async function rotateRefreshSession(client, rawToken, request, env) {
    const existing = await client.query(`select s.id, s.user_id, u.email, u.disabled_at
     from auth_refresh_sessions s
     join app_users u on u.id = s.user_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > now()
     for update of s`, [hashRefreshToken(rawToken)]);
    const row = existing.rows[0];
    if (!row || row.disabled_at)
        return null;
    const session = await createRefreshSession(client, row.user_id, request, env);
    await client.query(`update auth_refresh_sessions
     set revoked_at = now(), replaced_by = $2, last_used_at = now()
     where id = $1`, [row.id, session.id]);
    return {
        session,
        user: { id: row.user_id, email: row.email },
    };
}
export async function revokeRefreshSession(client, rawToken) {
    await client.query(`update auth_refresh_sessions
     set revoked_at = coalesce(revoked_at, now()), last_used_at = now()
     where token_hash = $1`, [hashRefreshToken(rawToken)]);
}
export function setRefreshCookie(reply, session, env) {
    reply.setCookie(REFRESH_COOKIE_NAME, session.rawToken, {
        httpOnly: true,
        secure: env.authCookieSecure,
        sameSite: "lax",
        path: "/api/auth",
        expires: session.expiresAt,
    });
}
export function clearRefreshCookie(reply, env) {
    reply.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.authCookieSecure,
        sameSite: "lax",
        path: "/api/auth",
    });
}
function hashRefreshToken(rawToken) {
    return createHash("sha256").update(rawToken).digest();
}
function requireJwtSecret(env) {
    if (!env.authJwtSecret) {
        throw new Error("AUTH_JWT_SECRET is required");
    }
    return new TextEncoder().encode(env.authJwtSecret);
}
