import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";
import type { ApiRequest, ApiResponse } from "../_types";

type UploadFile = { buffer: Buffer; mimeType: string; filename: string };
type UploadFields = { bucket: string; path: string };
type UploadResult = { fields: UploadFields; file: UploadFile | null };
type StorageEnvironment = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  r2: null | {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicBaseUrl: string;
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

const PUBLIC_BUCKET_PREFIX = {
  "menu-images": "menu",
  "promotion-images": "promotions",
  "payment-qr": "payment-qr",
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendError(response, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  if ((process.env.IMAGE_STORAGE_DRIVER ?? "r2").toLowerCase() !== "r2") {
    return sendError(response, 400, "R2_DISABLED", "R2 storage is not enabled");
  }

  const env = readEnv();
  if (!env.r2) {
    return sendError(response, 500, "R2_NOT_CONFIGURED", "R2 is not configured");
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return sendError(response, 500, "SUPABASE_NOT_CONFIGURED", "Supabase is not configured");
  }

  const token = getBearerToken(request);
  if (!token) {
    return sendError(response, 401, "UNAUTHORIZED", "Unauthorized");
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return sendError(response, 401, "UNAUTHORIZED", "Unauthorized");
  }

  const upload = await readMultipartUpload(request).catch((error) => ({
    error: error instanceof Error ? error.message : "Invalid upload",
  }));
  if ("error" in upload) {
    return sendError(response, 400, "INVALID_MULTIPART", upload.error);
  }

  if (!upload.file) {
    return sendError(response, 400, "MISSING_FILE", "Missing file", upload.fields);
  }
  const mimeType = normalizeMimeType(upload.file.mimeType);
  if (!ALLOWED_TYPES.has(mimeType)) {
    return sendError(response, 400, "UNSUPPORTED_IMAGE_TYPE", "Unsupported image type", {
      mimeType: upload.file.mimeType,
      filename: upload.file.filename,
    });
  }

  const key = buildR2ObjectKey(upload.fields.bucket, upload.fields.path);
  if (!key) {
    return sendError(response, 400, "INVALID_UPLOAD_PATH", "Invalid upload path", upload.fields);
  }

  const restaurantId = getRestaurantIdFromPath(upload.fields.path);
  if (!restaurantId) {
    return sendError(response, 400, "INVALID_RESTAURANT_ID", "Invalid upload path", upload.fields);
  }

  const userSupabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: membership, error: membershipError } = await userSupabase
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError || membership?.role !== "owner") {
    return sendError(response, 403, "FORBIDDEN", "Forbidden", {
      restaurantId,
      userId: userData.user.id,
      membershipError: membershipError?.message,
    });
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: key,
      Body: upload.file.buffer,
      ContentLength: upload.file.buffer.byteLength,
      ContentType: mimeType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return response.status(200).json({
    publicUrl: `${env.r2.publicBaseUrl}/${key}`,
  });
}

function readEnv(): StorageEnvironment {
  const r2 = allPresent(
    process.env.R2_ACCOUNT_ID,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME,
    process.env.R2_PUBLIC_BASE_URL,
  )
    ? {
        accountId: process.env.R2_ACCOUNT_ID!,
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        bucketName: (process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME)!,
        publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!.replace(/\/+$/, ""),
      }
    : null;

  return {
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
    r2,
  };
}

function allPresent(...values: Array<string | undefined>): boolean {
  return values.every((value) => typeof value === "string" && value.trim());
}

function sendError(response: ApiResponse, status: number, code: string, error: string, details?: unknown) {
  console.warn("[upload]", code, details ?? "");
  return response.status(status).json({ code, error });
}

function normalizeMimeType(mimeType: string | undefined): string {
  const value = String(mimeType || "").toLowerCase();
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  if (value === "image/x-png") return "image/png";
  return value;
}

function getBearerToken(request: ApiRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function readMultipartUpload(request: ApiRequest): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const fields: UploadFields = { bucket: "", path: "" };
    let file: UploadFile | null = null;
    let fileBytes = 0;
    let settled = false;

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 1,
        fields: 2,
      },
    });

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    busboy.on("field", (name: string, value: string) => {
      if (name === "bucket" || name === "path") {
        fields[name] = value;
      }
    });

    busboy.on("file", (_name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => {
        fileBytes += chunk.length;
        chunks.push(chunk);
      });
      stream.on("limit", () => {
        fail(new Error("File too large"));
      });
      stream.on("end", () => {
        if (settled) return;
        file = {
          buffer: Buffer.concat(chunks, fileBytes),
          mimeType: info.mimeType,
          filename: info.filename,
        };
      });
    });

    busboy.on("error", fail);
    busboy.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve({ fields, file });
    });

    request.pipe(busboy);
  });
}

function buildR2ObjectKey(bucket: string, path: string): string | null {
  const prefix = PUBLIC_BUCKET_PREFIX[bucket as keyof typeof PUBLIC_BUCKET_PREFIX];
  if (!prefix || !isSafeObjectPath(path)) return null;
  return `${prefix}/${path}`;
}

function getRestaurantIdFromPath(path: string): string | null {
  const firstSegment = path.split("/")[0]?.trim();
  return isUuid(firstSegment) ? firstSegment : null;
}

function isSafeObjectPath(path: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.,=-]*$/.test(path) && !path.includes("..");
}

function isUuid(value: string | undefined): boolean {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
