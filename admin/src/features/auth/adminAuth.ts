import { adminRequest } from "../../shared/adminApi";

export function bootstrapAdmin(email: string, password: string, bootstrapToken = "") {
  return adminRequest("/api/admin/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, bootstrapToken }),
  }, false);
}
