import { config as loadDotenv } from "dotenv";
const configuredEnvFile = process.env.SHOPQR_ENV_FILE?.trim();
loadDotenv({ path: [...(configuredEnvFile ? [configuredEnvFile] : []), ".env.local", ".env"] });
function readOptional(name) {
    const value = process.env[name]?.trim();
    return value ? value : null;
}
function readPort() {
    const raw = process.env.PORT ?? "4000";
    const port = Number(raw);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid PORT: ${raw}`);
    }
    return port;
}
function readPositiveInteger(name, fallback) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Invalid ${name}: ${raw}`);
    }
    return value;
}
function readBoolean(name, fallback) {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value)
        return fallback;
    if (value === "true" || value === "1")
        return true;
    if (value === "false" || value === "0")
        return false;
    throw new Error(`Invalid ${name}: ${process.env[name]}`);
}
export function loadEnv() {
    const env = {
        nodeEnv: process.env.NODE_ENV ?? "development",
        port: readPort(),
        host: process.env.HOST ?? "0.0.0.0",
        corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
        databaseUrl: readOptional("DATABASE_URL"),
        databaseSsl: readBoolean("DATABASE_SSL", false),
        databaseSslRejectUnauthorized: readBoolean("DATABASE_SSL_REJECT_UNAUTHORIZED", true),
        authJwtSecret: readOptional("AUTH_JWT_SECRET"),
        adminBootstrapToken: readOptional("ADMIN_BOOTSTRAP_TOKEN"),
        adminBootstrapEmail: readOptional("ADMIN_BOOTSTRAP_EMAIL"),
        authIssuer: process.env.AUTH_ISSUER?.trim() || "shopqr",
        authAccessTokenTtlMinutes: readPositiveInteger("AUTH_ACCESS_TOKEN_TTL_MINUTES", 15),
        authRefreshTokenTtlDays: readPositiveInteger("AUTH_REFRESH_TOKEN_TTL_DAYS", 30),
        authCookieSecure: readBoolean("AUTH_COOKIE_SECURE", (process.env.NODE_ENV ?? "development") === "production"),
        supabaseUrl: readOptional("SUPABASE_URL"),
        supabaseAnonKey: readOptional("SUPABASE_ANON_KEY"),
        supabaseServiceRoleKey: readOptional("SUPABASE_SERVICE_ROLE_KEY"),
        imageStorageDriver: process.env.IMAGE_STORAGE_DRIVER ?? "r2",
        r2AccountId: readOptional("R2_ACCOUNT_ID"),
        r2AccessKeyId: readOptional("R2_ACCESS_KEY_ID"),
        r2SecretAccessKey: readOptional("R2_SECRET_ACCESS_KEY"),
        r2BucketName: readOptional("R2_BUCKET") ?? readOptional("R2_BUCKET_NAME"),
        r2PublicBaseUrl: readOptional("R2_PUBLIC_BASE_URL"),
    };
    validateProductionEnv(env);
    return env;
}

function validateProductionEnv(env) {
    if (env.nodeEnv !== "production") return;

    if (!env.databaseUrl) {
        throw new Error("DATABASE_URL is required when NODE_ENV=production");
    }
    if (isPlaceholder(env.databaseUrl)) {
        throw new Error("DATABASE_URL still contains a placeholder value");
    }
    if (!env.authJwtSecret || Buffer.byteLength(env.authJwtSecret, "utf8") < 32) {
        throw new Error("AUTH_JWT_SECRET must contain at least 32 bytes in production");
    }
    if (env.adminBootstrapToken && Buffer.byteLength(env.adminBootstrapToken, "utf8") < 32) {
        throw new Error("ADMIN_BOOTSTRAP_TOKEN must contain at least 32 bytes when configured");
    }
    if (isPlaceholder(env.authJwtSecret)) {
        throw new Error("AUTH_JWT_SECRET still contains a placeholder value");
    }
    if (!env.authCookieSecure) {
        throw new Error("AUTH_COOKIE_SECURE=true is required when NODE_ENV=production");
    }

    const origins = env.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
    if (origins.length === 0 || origins.includes("*")) {
        throw new Error("CORS_ORIGIN must list explicit HTTPS origins in production");
    }
    for (const origin of origins) {
        let parsed;
        try {
            parsed = new URL(origin);
        } catch {
            throw new Error("CORS_ORIGIN contains an invalid origin");
        }
        if (parsed.protocol !== "https:" || parsed.origin !== origin || isPlaceholder(origin) || parsed.hostname === "localhost") {
            throw new Error("CORS_ORIGIN must contain HTTPS origins without paths in production");
        }
    }

    if (env.imageStorageDriver !== "r2") {
        throw new Error("IMAGE_STORAGE_DRIVER=r2 is required in production");
    }
    const missingR2 = [
        ["R2_ACCOUNT_ID", env.r2AccountId],
        ["R2_ACCESS_KEY_ID", env.r2AccessKeyId],
        ["R2_SECRET_ACCESS_KEY", env.r2SecretAccessKey],
        ["R2_BUCKET", env.r2BucketName],
        ["R2_PUBLIC_BASE_URL", env.r2PublicBaseUrl],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missingR2.length > 0) {
        throw new Error(`Missing required production R2 configuration: ${missingR2.join(", ")}`);
    }
    if ([env.r2AccountId, env.r2AccessKeyId, env.r2SecretAccessKey, env.r2BucketName, env.r2PublicBaseUrl].some(isPlaceholder)) {
        throw new Error("R2 configuration still contains placeholder values");
    }
    try {
        if (new URL(env.r2PublicBaseUrl).protocol !== "https:") throw new Error();
    } catch {
        throw new Error("R2_PUBLIC_BASE_URL must be an HTTPS URL in production");
    }
}

function isPlaceholder(value) {
    return /(?:CHANGE-ME|REPLACE|YOUR-|example\.com)/i.test(value ?? "");
}
