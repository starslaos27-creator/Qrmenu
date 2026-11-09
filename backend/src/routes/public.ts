import { createPublicController } from "../controllers/public.controller.js";

export async function registerPublicRoutes(app, env) {
  const controller = createPublicController(app, env);
  app.get("/api/public/menu/:tableCode", controller.get_api_public_menu_tableCode);
  app.get("/api/public/menu/table/:tableId", controller.get_api_public_menu_table_tableId);
  app.get("/api/public/tables/:tableCode/orders", controller.get_api_public_tables_tableCode_orders);
  app.post("/api/public/orders", controller.post_api_public_orders);
  app.post("/api/public/call-staff", controller.post_api_public_call_staff);
}
