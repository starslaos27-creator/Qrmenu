import { createChatController } from "../controllers/chat.controller.js";
export async function registerChatRoutes(app, env) {
    const controller = createChatController(app, env);
    app.get("/api/public/staff-online/:tableCode", controller.get_api_public_staff_online_tableCode);
    app.get("/api/public/chat/:tableCode", controller.get_api_public_chat_tableCode);
    app.post("/api/public/chat/:tableCode", controller.post_api_public_chat_tableCode);
    app.get("/api/restaurants/:restaurantId/chat", controller.get_api_restaurants_restaurantId_chat);
    app.get("/api/restaurants/:restaurantId/chat/:tableId", controller.get_api_restaurants_restaurantId_chat_tableId);
    app.post("/api/restaurants/:restaurantId/chat/:tableId", controller.post_api_restaurants_restaurantId_chat_tableId);
}
