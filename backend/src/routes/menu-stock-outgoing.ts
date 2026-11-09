import { createMenuStockOutgoingController } from "../controllers/menu-stock-outgoing.controller.js";

export async function registerMenuStockOutgoing(app, env, helpers) {
  const controller = createMenuStockOutgoingController(app, env, helpers);
  app.get("/api/restaurants/:restaurantId/menu-outgoing", controller.get_api_restaurants_restaurantId_menu_outgoing);
}
