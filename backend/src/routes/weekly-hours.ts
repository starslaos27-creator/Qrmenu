import { createWeeklyHoursController } from "../controllers/weekly-hours.controller.js";

export async function registerWeeklyHoursRoutes(app, env) {
  const controller = createWeeklyHoursController(app, env);
  app.get(controller.path, controller.handler1);
  app.put(controller.path, controller.handler2);
}
