import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { createSupabaseClients } from "./plugins/supabase.js";
import { registerDatabase } from "./plugins/database.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerStorageRoutes } from "./routes/storage.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerManagementRoutes } from "./routes/management.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerStockDepositRoutes } from "./routes/stock-deposits.js";
import { registerFinanceRoutes } from "./routes/finance.js";
import { registerFinanceWorkspaceRoutes } from "./routes/finance-workspace.js";
import { registerMiscRoutes } from "./routes/misc.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerAdminRoutes } from "./admin/routes.js";
import { registerProRequestRoutes } from "./routes/pro-requests.js";
import { registerWeeklyHoursRoutes } from "./routes/weekly-hours.js";
export async function createApp(env) {
    const app = Fastify({
        logger: {
            level: env.nodeEnv === "production" ? "info" : "debug",
        },
    });
    registerDatabase(app, env);
    app.decorate("supabase", createSupabaseClients(env));
    await app.register(cors, {
        origin: (origin, cb) => {
            if (!origin || env.nodeEnv !== "production") {
                cb(null, true);
                return;
            }
            const allowed = env.corsOrigin.split(",").map((x) => x.trim());
            if (allowed.includes("*") || allowed.includes(origin)) {
                cb(null, true);
            }
            else {
                cb(new Error("Not allowed by CORS"), false);
            }
        },
        credentials: true,
    });
    await app.register(cookie);
    await app.register(multipart);
    await app.register(registerHealthRoutes, env);
    await app.register(registerAuthRoutes, env);
    await app.register(registerStorageRoutes, env);
    await app.register(registerPublicRoutes);
    await app.register(registerManagementRoutes, env);
    await app.register(registerOrderRoutes, env);
    await app.register(registerInventoryRoutes, env);
    await app.register(registerStockDepositRoutes, env);
    await app.register(registerFinanceRoutes, env);
    await app.register(registerFinanceWorkspaceRoutes, env);
    await app.register(registerMiscRoutes, env);
    await app.register(registerChatRoutes, env);
    await app.register(registerAdminRoutes, env);
    await app.register(registerProRequestRoutes, env);
    await app.register(registerWeeklyHoursRoutes, env);
    app.setNotFoundHandler(async (_request, reply) => {
        return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    });
    app.setErrorHandler((error, _request, reply) => {
        app.log.error(error);
        return reply.status(500).send({ ok: false, error: "INTERNAL_SERVER_ERROR" });
    });
    return app;
}
