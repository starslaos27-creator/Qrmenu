import { createAdminController } from "../controllers/admin.controller.js";
import { createPlatformFinanceController } from "../controllers/platform-finance.controller.js";

export async function registerAdminRoutes(app, env) {
  const controller = createAdminController(app, env);
  const finance = createPlatformFinanceController(app, env);
  app.get("/api/admin/bootstrap-status", controller.get_api_admin_bootstrap_status);
  app.post("/api/admin/bootstrap", controller.post_api_admin_bootstrap);
  app.post("/api/admin/auth/login", controller.post_api_admin_auth_login);
  app.post("/api/admin/auth/forgot-password", controller.post_api_admin_auth_forgot_password);
  app.get("/api/admin/auth/password-reset/:token", controller.get_api_admin_auth_password_reset_token);
  app.post("/api/admin/auth/reset-password", controller.post_api_admin_auth_reset_password);
  app.get("/api/admin/me", controller.get_api_admin_me);
  app.get("/api/admin/summary", controller.get_api_admin_summary);
  app.get("/api/admin/restaurants", controller.get_api_admin_restaurants);
  app.get("/api/admin/restaurants/:restaurantId", controller.get_api_admin_restaurants_restaurantId);
  app.get("/api/admin/users", controller.get_api_admin_users);
  app.get("/api/admin/users/:userId", controller.get_api_admin_users_userId);
  app.patch("/api/admin/restaurants/:restaurantId/status", controller.patch_api_admin_restaurants_restaurantId_status);
  app.patch("/api/admin/users/:userId/status", controller.patch_api_admin_users_userId_status);
  app.post("/api/admin/users/:userId/password-reset-link", controller.post_api_admin_users_userId_password_reset_link);
  app.post("/api/admin/users/:userId/set-password", controller.post_api_admin_users_userId_set_password);
  app.get("/api/admin/audit-logs", controller.get_api_admin_audit_logs);
  app.get("/api/admin/finance", finance.get_api_admin_finance);
  app.post("/api/admin/finance", finance.post_api_admin_finance);
  app.post("/api/admin/finance/:entryId/void", finance.post_api_admin_finance_entry_void);
}
