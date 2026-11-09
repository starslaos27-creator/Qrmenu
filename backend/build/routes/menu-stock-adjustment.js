import { createMenuStockAdjustmentController } from "../controllers/menu-stock-adjustment.controller.js";
export async function registerMenuStockAdjustment(app, env, helpers) {
    const controller = createMenuStockAdjustmentController(app, env, helpers);
    app.post("/api/restaurants/:restaurantId/menus/:resourceId/receive", controller.post_api_restaurants_restaurantId_menus_resourceId_receive);
}
