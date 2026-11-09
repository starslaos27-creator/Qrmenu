import { createMiscController } from "../controllers/misc.controller.js";

export async function registerMiscRoutes(app, env) {
  const controller = createMiscController(app, env);
  app.get("/api/restaurants/:restaurantId/audit-logs", controller.get_api_restaurants_restaurantId_audit_logs);
  app.get("/api/restaurants/:restaurantId/feedback", controller.get_api_restaurants_restaurantId_feedback);
  app.post("/api/restaurants/:restaurantId/feedback", controller.post_api_restaurants_restaurantId_feedback);
}
