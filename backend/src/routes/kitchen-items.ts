import { createKitchenItemController } from "../controllers/kitchen-items.controller.js";

export async function registerKitchenItemRoutes(app, env, services) {
  const controller = createKitchenItemController(app, env, services);
  app.patch("/api/restaurants/:restaurantId/orders/:orderId/items/:itemIndex/resolve", controller.patch_api_restaurants_restaurantId_orders_orderId_items_itemIndex_resolve);
  app.post("/api/restaurants/:restaurantId/orders/:orderId/items/:itemIndex/confirm", controller.post_api_restaurants_restaurantId_orders_orderId_items_itemIndex_confirm);
}
