import { createProRequestController } from "../controllers/pro-requests.controller.js";

export async function registerProRequestRoutes(app, env) {
  const controller = createProRequestController(app, env);
  app.get("/api/pro-payment-qr", controller.get_api_pro_payment_qr);
  app.put("/api/admin/pro-payment-qr", controller.put_api_admin_pro_payment_qr);
  app.get("/api/admin/pro-requests/count", controller.get_api_admin_pro_request_count);
  app.get("/api/admin/pro-requests/:id/slip", controller.get_api_admin_pro_request_slip);
  app.get("/api/pro-pricing", controller.get_api_pro_pricing);
  app.get("/api/admin/pro-pricing", controller.get_api_admin_pro_pricing);
  app.put("/api/admin/pro-pricing", controller.put_api_admin_pro_pricing);
  app.get("/api/restaurants/:restaurantId/pro-countdown", controller.get_api_restaurants_restaurantId_pro_countdown);
  app.get("/api/restaurants/:restaurantId/pro-requests", controller.get_api_restaurants_restaurantId_pro_requests);
  app.post("/api/restaurants/:restaurantId/pro-requests", controller.post_api_restaurants_restaurantId_pro_requests);
  app.get("/api/admin/pro-requests", controller.get_api_admin_pro_requests);
  app.post("/api/admin/restaurants/:restaurantId/pro-purchases", controller.post_api_admin_restaurants_restaurantId_pro_purchases);
  app.post("/api/admin/pro-requests/:id/review", controller.post_api_admin_pro_requests_id_review);
}
