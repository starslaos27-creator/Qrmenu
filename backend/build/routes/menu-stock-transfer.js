import { createMenuStockTransferController } from "../controllers/menu-stock-transfer.controller.js";
export async function registerMenuStockTransfer(app, env, helpers) {
    const controller = createMenuStockTransferController(app, env, helpers);
    app.get("/api/restaurants/:restaurantId/menu-transfer-destinations", controller.get_api_restaurants_restaurantId_menu_transfer_destinations);
    app.post("/api/restaurants/:restaurantId/menus/:resourceId/stock-transfers", controller.post_api_restaurants_restaurantId_menus_resourceId_stock_transfers);
}
