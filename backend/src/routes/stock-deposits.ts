import { createStockDepositsController } from "../controllers/stock-deposits.controller.js";

export async function registerStockDepositRoutes(app, env) {
  const controller = createStockDepositsController(app, env);
  if (app.db) {
    let expiring = false;
    const expireOverdue = async () => {
      if (expiring) return;
      expiring = true;
      try {
        const result = await controller.expireOverdue();
        if (result.rowCount) app.log.info({ count: result.rowCount }, "Expired overdue stock deposits");
      } catch (error) {
        app.log.error({ err: error }, "Could not expire overdue stock deposits");
      } finally {
        expiring = false;
      }
    };
    void expireOverdue();
    const timer = setInterval(() => void expireOverdue(), 60_000);
    timer.unref?.();
    app.addHook("onClose", async () => clearInterval(timer));
  }
  app.get("/api/restaurants/:restaurantId/stock-deposits", controller.list);
  app.post("/api/restaurants/:restaurantId/stock-deposits", controller.create);
  app.post("/api/restaurants/:restaurantId/stock-deposits/:depositId/pickup", controller.pickup);
  app.post("/api/restaurants/:restaurantId/stock-deposits/:depositId/resolve-expiry", controller.resolveExpiry);
}
