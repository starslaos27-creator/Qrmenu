import { createOrderController } from "../controllers/orders.controller.js";
export async function registerOrderRoutes(app, env) {
    const controller = createOrderController(app, env);
    app.get("/api/restaurants/:restaurantId/orders", controller.get_api_restaurants_restaurantId_orders);
    app.patch("/api/restaurants/:restaurantId/orders/:orderId/accept", controller.patch_api_restaurants_restaurantId_orders_orderId_accept);
    app.patch("/api/restaurants/:restaurantId/orders/:orderId/status", controller.patch_api_restaurants_restaurantId_orders_orderId_status);
    app.patch("/api/restaurants/:restaurantId/orders/:orderId/items", controller.patch_api_restaurants_restaurantId_orders_orderId_items);
    app.post("/api/restaurants/:restaurantId/tables/:tableId/request-check", controller.post_api_restaurants_restaurantId_tables_tableId_request_check);
    app.post("/api/restaurants/:restaurantId/tables/:tableId/settle", controller.post_api_restaurants_restaurantId_tables_tableId_settle);
    app.post("/api/restaurants/:restaurantId/bills/:receiptNumber/reopen", controller.post_api_restaurants_restaurantId_bills_receiptNumber_reopen);
    app.post("/api/restaurants/:restaurantId/tables/:tableId/transfer", controller.post_api_restaurants_restaurantId_tables_tableId_transfer);
    app.get("/api/restaurants/:restaurantId/call-staff", controller.get_api_restaurants_restaurantId_call_staff);
    app.patch("/api/restaurants/:restaurantId/call-staff/:requestId/ack", controller.patch_api_restaurants_restaurantId_call_staff_requestId_ack);
}
