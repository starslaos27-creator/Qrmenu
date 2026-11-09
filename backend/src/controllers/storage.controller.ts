import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireAuth } from "../security/auth.js";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
]);
const PUBLIC_BUCKET_PREFIX = {
    "menu-images": "menu",
    "promotion-images": "promotions",
    "payment-qr": "payment-qr",
};

export function createStorageController(app, env) {
  const post_api_storage_upload = async (request, reply) => {
        if (env.imageStorageDriver !== "r2") {
            return reply.status(400).send({ error: "Unsupported image storage driver" });
        }
        const r2 = getR2Config(env);
        if (!r2) {
            return reply.status(503).send({ error: "Image storage is not configured" });
        }
        const user = await requireAuth(request, reply, env);
        if (!user)
            return;
        if (!app.db) {
            return reply.status(503).send({ error: "Database is not configured" });
        }
        const part = await request.file({
            limits: {
                fileSize: MAX_IMAGE_SIZE,
                files: 1,
            },
        });
        if (!part) {
            return reply.status(400).send({ error: "Missing file" });
        }
        if (!ALLOWED_TYPES.has(part.mimetype)) {
            return reply.status(400).send({ error: "Unsupported image type" });
        }
        let body;
        try {
            body = await part.toBuffer();
        } catch (error) {
            if (error.code === "FST_REQ_FILE_TOO_LARGE") return reply.status(413).send({ error: "File too large (maximum 5 MB)" });
            throw error;
        }
        if (part.file.truncated) return reply.status(413).send({ error: "File too large (maximum 5 MB)" });
        const fields = readUploadFields(part.fields);
        const key = buildR2ObjectKey(fields.bucket, fields.path);
        if (!key) {
            return reply.status(400).send({ error: "Invalid upload path" });
        }
        const restaurantId = getRestaurantIdFromPath(fields.path);
        if (!restaurantId) {
            return reply.status(400).send({ error: "Invalid upload path" });
        }
        const membership = await app.db.query(`select m.role
       from restaurant_members m
       join restaurants r on r.id = m.restaurant_id
       join app_users u on u.id = m.user_id
       where m.restaurant_id = $1 and m.user_id = $2
         and r.suspended_at is null
         and u.disabled_at is null
       limit 1`, [restaurantId, user.id]);
        if (membership.rows[0]?.role !== "owner") {
            return reply.status(403).send({ error: "Forbidden" });
        }
        const client = new S3Client({
            region: "auto",
            endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: r2.accessKeyId,
                secretAccessKey: r2.secretAccessKey,
            },
        });
        await client.send(new PutObjectCommand({
            Bucket: r2.bucketName,
            Key: key,
            Body: body,
            ContentLength: body.byteLength,
            ContentType: part.mimetype || "application/octet-stream",
            CacheControl: "public, max-age=31536000, immutable",
        }));
        return reply.send({ publicUrl: `${r2.publicBaseUrl}/${key}` });
    };
  return { post_api_storage_upload };
}

function readUploadFields(fields) {
    return {
        bucket: readTextField(fields.bucket),
        path: readTextField(fields.path),
    };
}
function readTextField(field) {
    if (!field || typeof field !== "object")
        return "";
    const value = field.value;
    return typeof value === "string" ? value : "";
}
function buildR2ObjectKey(bucket, path) {
    const prefix = PUBLIC_BUCKET_PREFIX[bucket];
    if (!prefix || !isSafeObjectPath(path))
        return null;
    return `${prefix}/${path}`;
}
function getRestaurantIdFromPath(path) {
    const firstSegment = path.split("/")[0];
    return isUuid(firstSegment) ? firstSegment : null;
}
function isSafeObjectPath(path) {
    return /^[a-zA-Z0-9][a-zA-Z0-9/_.,=-]*$/.test(path) && !path.includes("..");
}
function isUuid(value) {
    return Boolean(value &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
function getR2Config(env) {
    if (!env.r2AccountId ||
        !env.r2AccessKeyId ||
        !env.r2SecretAccessKey ||
        !env.r2BucketName ||
        !env.r2PublicBaseUrl) {
        return null;
    }
    return {
        accountId: env.r2AccountId,
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
        bucketName: env.r2BucketName,
        publicBaseUrl: env.r2PublicBaseUrl.replace(/\/+$/, ""),
    };
}
