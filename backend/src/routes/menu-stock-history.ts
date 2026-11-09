import { createMenuStockHistoryController } from "../controllers/menu-stock-history.controller.js";

export async function registerMenuStockHistory(app, env, helpers) {
  const controller = createMenuStockHistoryController(app, env, helpers);
  app.get("/api/restaurants/:restaurantId/menu-receipts", controller.get_api_restaurants_restaurantId_menu_receipts);
}
