import { createFinanceWorkspaceController } from "../controllers/finance-workspace.controller.js";
export async function registerFinanceWorkspaceRoutes(app, env) {
    const controller = createFinanceWorkspaceController(app, env);
    app.get(controller.base + '/access', controller.handler1);
    app.get(controller.base + '/workspace', controller.handler2);
    app.put(controller.base + '/settings', controller.handler3);
    app.put(controller.base + '/accounts/:method', controller.handler4);
    app.post(controller.base + '/transfers', controller.handler5);
    app.get(controller.base + '/closing-preview', controller.handler6);
    app.post(controller.base + '/closings', controller.handler7);
    app.post(controller.base + '/receipts', controller.handler8);
    app.get(controller.base + '/receipts/:receiptId', controller.handler9);
}
