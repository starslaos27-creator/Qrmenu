import { apiRequest } from "../../shared/api/client";

export interface AuthUser {
  id: string;
  email: string;
}

export interface RestaurantMembership {
  restaurant_id: string;
  restaurant_name: string;
  currency_code: "LAK" | "THB" | "USD";
  role: string;
  page_permissions?: Record<string, boolean | "view" | "admin"> | null;
}

export interface RestaurantSession {
  user: AuthUser;
  membership: RestaurantMembership | null;
}

export function loadRestaurantSession() {
  return apiRequest<RestaurantSession>("/api/auth/me");
}
