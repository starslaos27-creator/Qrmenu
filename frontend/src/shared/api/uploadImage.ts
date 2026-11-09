import { apiRequest } from "./client";

export type ImageBucket = "menu-images" | "promotion-images" | "payment-qr";

export async function uploadRestaurantImage({
  restaurantId,
  bucket,
  file,
  maxBytes = 5 * 1024 * 1024,
}: {
  restaurantId: string;
  bucket: ImageBucket;
  file: File;
  maxBytes?: number;
}): Promise<string> {
  if (file.size > maxBytes) throw new Error("IMAGE_TOO_LARGE");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
  if (!allowed.has(file.type)) throw new Error("UNSUPPORTED_IMAGE_TYPE");

  const extension = file.name.toLowerCase().split(".").pop();
  const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : "jpg";
  const body = new FormData();
  body.set("bucket", bucket);
  body.set("path", `${restaurantId}/${crypto.randomUUID()}.${safeExtension}`);
  body.set("file", file);

  const result = await apiRequest<{ publicUrl: string }>("/api/storage/upload", {
    method: "POST",
    body,
  });
  return result.publicUrl;
}
