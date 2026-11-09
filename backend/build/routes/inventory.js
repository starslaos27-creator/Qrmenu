import { createInventoryController } from "../controllers/inventory.controller.js";
export async function registerInventoryRoutes(app, env) {
    const controller = createInventoryController(app, env);
    app.get("/api/restaurants/:restaurantId/stock/locations", controller.get_api_restaurants_restaurantId_stock_locations);
    app.post("/api/restaurants/:restaurantId/stock/locations", controller.post_api_restaurants_restaurantId_stock_locations);
    app.get("/api/restaurants/:restaurantId/stock/items", controller.get_api_restaurants_restaurantId_stock_items);
    app.post("/api/restaurants/:restaurantId/stock/items", controller.post_api_restaurants_restaurantId_stock_items);
    app.patch("/api/restaurants/:restaurantId/stock/items/:itemId", controller.patch_api_restaurants_restaurantId_stock_items_itemId);
    app.get("/api/restaurants/:restaurantId/stock/movements", controller.get_api_restaurants_restaurantId_stock_movements);
    app.post("/api/restaurants/:restaurantId/stock/movements", controller.post_api_restaurants_restaurantId_stock_movements);
    app.get("/api/restaurants/:restaurantId/menu-inventory-components", controller.get_api_restaurants_restaurantId_menu_inventory_components);
    app.put("/api/restaurants/:restaurantId/menus/:menuId/inventory-components", controller.put_api_restaurants_restaurantId_menus_menuId_inventory_components);
}
