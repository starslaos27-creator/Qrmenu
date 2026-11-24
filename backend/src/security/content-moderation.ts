import { isIP } from "node:net";

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const ALLOWED_TEXT_CATEGORIES = ["sexual", "sexual/minors", "violence", "violence/graphic", "self-harm"];
const BLOCKED_IMAGE_CATEGORIES = [
  "sexual_content",
  "nudity",
  "firearm",
  "military_weapon",
  "explosive_or_missile",
  "war_or_armed_combat",
  "graphic_violence",
];
const visionSchema = {
  type: "object",
  properties: {
    blocked: { type: "boolean" },
    categories: { type: "array", items: { type: "string", enum: BLOCKED_IMAGE_CATEGORIES } },
  },
  required: ["blocked", "categories"],
  additionalProperties: false,
};
const imagePolicy = `You are a strict image-safety classifier for a restaurant menu and promotions platform. Block an image if it visibly contains any of: pornography or sexual activity; naked genitalia or clearly nude people; any firearm including handguns, rifles, military firearms, replicas, toys, or illustrations; military weapons, explosives, missiles, armed combat, or war scenes; graphic blood, gore, or physical violence. Do not block ordinary food, kitchen equipment, ordinary kitchen knives, red sauces, or harmless scenes. Only mark categories that are visibly present. Return blocked=true if any listed prohibited category is present.`;
const approvedImageCache = new Map<string, number>();
const APPROVAL_TTL_MS = 10 * 60 * 1000;

export interface ModerationDecision {
  allowed: boolean;
  code?: "IMAGE_CONTENT_NOT_ALLOWED" | "TEXT_CONTENT_NOT_ALLOWED" | "CONTENT_MODERATION_UNAVAILABLE";
  categories?: string[];
  status?: number;
}

export async function checkUploadedImage(env, mimeType: string, body: Buffer): Promise<ModerationDecision> {
  if (!isSupportedImageType(mimeType) || !isStaticImage(mimeType, body)) {
    return { allowed: false, code: "IMAGE_CONTENT_NOT_ALLOWED", categories: ["unsupported_image_format"], status: 415 };
  }
  const imageUrl = `data:${mimeType};base64,${body.toString("base64")}`;
  return checkImageSource(env, imageUrl);
}

export async function checkImageUrl(env, value: unknown): Promise<ModerationDecision> {
  if (value == null || value === "") return { allowed: true };
  if (typeof value !== "string" || !isSafeImageUrl(value)) {
    return { allowed: false, code: "IMAGE_CONTENT_NOT_ALLOWED", categories: ["invalid_image_url"], status: 400 };
  }
  const cachedUntil = approvedImageCache.get(value);
  if (cachedUntil && cachedUntil > Date.now()) return { allowed: true };
  if (cachedUntil) approvedImageCache.delete(value);

  return checkImageSource(env, value);
}

async function checkImageSource(env, value: string): Promise<ModerationDecision> {
  const apiKey = env.openAiApiKey;
  // Moderation is optional for local/self-hosted installs. Preserve menu and
  // image upload flows when no moderation key has been configured.
  if (!apiKey) return { allowed: true };
  try {
    const [moderation, visual] = await Promise.all([
      requestModeration(apiKey, [{ type: "image_url", image_url: { url: value } }]),
      requestVisualPolicy(apiKey, env.contentVisionModel || "gpt-5.4-mini", value),
    ]);
    const categories = [...new Set([...moderation, ...visual])];
    if (categories.length) return { allowed: false, code: "IMAGE_CONTENT_NOT_ALLOWED", categories, status: 422 };
    return { allowed: true };
  } catch {
    return unavailable();
  }
}

export async function checkTextContent(env, values: unknown[]): Promise<ModerationDecision> {
  const text = values.filter((value): value is string => typeof value === "string")
    .map((value) => value.trim()).filter(Boolean).join("\n").slice(0, 8000);
  if (!text) return { allowed: true };
  if (!env.openAiApiKey) return { allowed: true };
  try {
    const categories = await requestModeration(env.openAiApiKey, text);
    const relevant = categories.filter((category) => ALLOWED_TEXT_CATEGORIES.includes(category));
    return relevant.length
      ? { allowed: false, code: "TEXT_CONTENT_NOT_ALLOWED", categories: relevant, status: 422 }
      : { allowed: true };
  } catch {
    return unavailable();
  }
}

export function rememberApprovedImage(url: string) {
  approvedImageCache.set(url, Date.now() + APPROVAL_TTL_MS);
  if (approvedImageCache.size > 500) {
    const now = Date.now();
    for (const [key, expiry] of approvedImageCache) if (expiry <= now) approvedImageCache.delete(key);
    while (approvedImageCache.size > 500) approvedImageCache.delete(approvedImageCache.keys().next().value!);
  }
}

export function sendModerationFailure(reply, decision: ModerationDecision) {
  if (decision.allowed) return false;
  reply.code(decision.status || 503).send({ error: decision.code || "CONTENT_MODERATION_UNAVAILABLE", categories: decision.categories || [] });
  return true;
}

async function requestModeration(apiKey: string, input: unknown) {
  const response = await fetch(MODERATION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`MODERATION_HTTP_${response.status}`);
  const body = await response.json() as { results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }> };
  const result = body.results?.[0];
  if (!result || !result.categories) throw new Error("INVALID_MODERATION_RESPONSE");
  return result.flagged
    ? ALLOWED_TEXT_CATEGORIES.filter((category) => result.categories?.[category] === true)
    : [];
}

async function requestVisualPolicy(apiKey: string, model: string, imageUrl: string) {
  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: imagePolicy },
          { type: "input_image", image_url: imageUrl, detail: "high" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "image_content_safety",
          strict: true,
          schema: visionSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`VISION_HTTP_${response.status}`);
  const body = await response.json() as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  const outputText = body.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("INVALID_VISION_RESPONSE");
  const result = JSON.parse(outputText) as { blocked?: boolean; categories?: string[] };
  if (typeof result.blocked !== "boolean" || !Array.isArray(result.categories)) throw new Error("INVALID_VISION_RESULT");
  if (!result.blocked && result.categories.length === 0) return [];
  const categories = result.categories.filter((category) => BLOCKED_IMAGE_CATEGORIES.includes(category));
  return categories.length ? categories : ["policy_violation"];
}

function unavailable(): ModerationDecision {
  return { allowed: false, code: "CONTENT_MODERATION_UNAVAILABLE", categories: [], status: 503 };
}

function isSupportedImageType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

function isStaticImage(mimeType: string, body: Buffer) {
  if (mimeType === "image/png" && body.includes(Buffer.from("acTL"))) return false;
  if (mimeType === "image/webp" && (body.includes(Buffer.from("ANIM")) || body.includes(Buffer.from("ANMF")))) return false;
  return true;
}

function isSafeImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    // Do not let a stored image URL point at local/private IP literals. This
    // includes bracketed IPv6 addresses, which URL.hostname preserves.
    if (isIP(host.replace(/^\[|\]$/g, ""))) return false;
    if (["localhost", "localhost.localdomain", "::1", "0.0.0.0"].includes(host) || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}
