import { createHealthController } from "../controllers/health.controller.js";

export async function registerHealthRoutes(app, env) {
  const controller = createHealthController(app, env);
  app.get("/health", controller.get_health);
  app.get("/ready", controller.get_ready);
}
