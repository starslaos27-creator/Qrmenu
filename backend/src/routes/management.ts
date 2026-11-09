import { createManagementController } from "../controllers/management.controller.js";

export async function registerManagementRoutes(app, env) {
  const controller = createManagementController(app, env);
  app.get("/api/restaurants/:restaurantId", controller.get_api_restaurants_restaurantId);
  app.patch("/api/restaurants/:restaurantId", controller.patch_api_restaurants_restaurantId);
  app.get("/api/restaurants/:restaurantId/dashboard-summary", controller.get_api_restaurants_restaurantId_dashboard_summary);
}
