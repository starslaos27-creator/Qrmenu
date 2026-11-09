import { createHash } from "node:crypto";
import { normalizeEmail } from "./auth.js";

const UNKNOWN_IDENTIFIER = "__unknown_username__";

function identifierHash(email) {
  return createHash("sha256").update(normalizeEmail(email), "utf8").digest("hex");
}

export async function recordLoginFailure(db, email, userId = null) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 320) return;
  const key = userId ? identifierHash(normalized) : UNKNOWN_IDENTIFIER;
  await db.query(
    `insert into app_login_failures (identifier_hash, user_id, failed_count)
     values ($1, $2, 1)
     on conflict (identifier_hash) do update
       set user_id = coalesce(excluded.user_id, app_login_failures.user_id),
           failed_count = case
             when app_login_failures.failed_count < 9223372036854775807
               then app_login_failures.failed_count + 1
             else app_login_failures.failed_count
           end,
           last_failed_at = now()`,
    [key, userId]
  );
}

export async function clearLoginFailures(db, email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 320) return;
  await db.query("delete from app_login_failures where identifier_hash = $1", [
    identifierHash(normalized),
  ]);
}
