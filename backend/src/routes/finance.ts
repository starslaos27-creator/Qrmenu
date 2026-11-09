import { createFinanceController } from "../controllers/finance.controller.js";

export async function registerFinanceRoutes(app, env) {
  const controller = createFinanceController(app, env);
  app.get("/api/restaurants/:restaurantId/finance", controller.get_api_restaurants_restaurantId_finance);
  app.get("/api/restaurants/:restaurantId/finance/export", controller.get_api_restaurants_restaurantId_finance_export);
  app.post("/api/restaurants/:restaurantId/finance/entries", controller.post_api_restaurants_restaurantId_finance_entries);
  app.post("/api/restaurants/:restaurantId/finance/entries/:entryId/void", controller.post_api_restaurants_restaurantId_finance_entries_entryId_void);
}
