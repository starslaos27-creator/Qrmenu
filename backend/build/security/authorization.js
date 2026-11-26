import { requireAuth } from "./auth.js";
import { getOrderFeeBillingState, isOrderFeeRestrictedPath } from "./order-fee-billing.js";
export async function requireRestaurantAccess(request, reply, env, restaurantId, allowedRoles = undefined) {
    const user = await requireAuth(request, reply, env);
    if (!user)
        return null;
    if (!request.server.db) {
        await reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        return null;
    }
    let result;
    try {
        result = await request.server.db.query(`select m.role, m.page_permissions, r.suspended_at
         from restaurant_members m join restaurants r on r.id = m.restaurant_id
         join app_users u on u.id = m.user_id
         where m.restaurant_id = $1 and m.user_id = $2 and u.disabled_at is null limit 1`, [restaurantId, user.id]);
    }
    catch (error) {
        if (!isUndefinedColumn(error))
            throw error;
        result = await request.server.db.query(`select m.role, r.suspended_at
         from restaurant_members m join restaurants r on r.id = m.restaurant_id
         join app_users u on u.id = m.user_id
         where m.restaurant_id = $1 and m.user_id = $2 and u.disabled_at is null limit 1`, [restaurantId, user.id]);
    }
    const membership = result.rows[0];
    if (!membership || membership.suspended_at) {
        await reply.status(403).send({ ok: false, error: "FORBIDDEN" });
        return null;
    }
    const pagePermissions = membership.page_permissions;
    const changesData = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
    let pagePermission = false;
    let pageViewPermission = false;
    if (membership.role !== "owner" && pagePermissions) {
        const sections = restaurantSectionsForRoute(request);
        const relevantSections = sections ? (Array.isArray(sections) ? sections : [sections]) : [];
        const levels = relevantSections.map((section) => pagePermissionLevel(pagePermissions[section]));
        pageViewPermission = levels.some((level) => level === "view" || level === "admin");
        pagePermission = levels.some((level) => level === "admin");
        if (relevantSections.length && (!pageViewPermission || (changesData && !pagePermission))) {
            await reply.status(403).send({ ok: false, error: "PAGE_ACCESS_DENIED" });
            return null;
        }
    }
    const requestPagePermission = changesData ? pagePermission : pageViewPermission;
    if (allowedRoles && !allowedRoles.includes(membership.role) && !requestPagePermission) {
        await reply.status(403).send({ ok: false, error: "FORBIDDEN" });
        return null;
    }
    if (changesData && isOrderFeeRestrictedPath(request.url)) {
        try {
            const testMode = env.nodeEnv !== "production" && process.env.ORDER_FEE_TEST_MODE === "true" && (() => {
                try {
                    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(env.databaseUrl).hostname);
                }
                catch {
                    return false;
                }
            })();
            const billing = await getOrderFeeBillingState(request.server.db, restaurantId, testMode);
            if (billing.restricted) {
                await reply.status(402).send({ ok: false, error: "ORDER_FEE_OVERDUE", payBy: billing.payableCycle?.payBy });
                return null;
            }
        }
        catch (error) {
            request.log.error({ err: error, restaurantId }, "Could not verify order-fee access deadline");
            await reply.status(503).send({ ok: false, error: "ORDER_FEE_STATUS_UNAVAILABLE" });
            return null;
        }
    }
    // Treat authenticated restaurant API activity as presence as well. This
    // keeps status accurate even when a browser has cached the dashboard's
    // optional client-side heartbeat module.
    try {
        await request.server.db.query(`update app_users
         set last_activity_at = now()
         where id = $1 and disabled_at is null
           and last_activity_at < now() - interval '1 minute'`, [user.id]);
    }
    catch (error) {
        request.log.warn({ err: error }, "Could not update account activity timestamp");
    }
    return { user, restaurantId, role: membership.role, pagePermissions: pagePermissions || null, pagePermission, pageViewPermission };
}
function pagePermissionLevel(value) {
    if (value === true || value === "admin")
        return "admin";
    if (value === "view")
        return "view";
    return null;
}
function isUndefinedColumn(error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "42703";
}
function restaurantSectionsForRoute(request) {
    const route = request.routeOptions?.url || request.url.split("?")[0];
    const method = request.method.toUpperCase();
    const read = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (route.endsWith("/dashboard-summary"))
        return "home";
    if (route === "/api/restaurants/:restaurantId")
        return read ? ["backend", "kitchen"] : "backend";
    if (route.includes("/members"))
        return read ? ["settings", "kitchen", "audit"] : "settings";
    if (route.includes("/invites") || route.includes("weekly-hours"))
        return "settings";
    if (route.includes("/promotions"))
        return "promotions";
    if (route.includes("/categories"))
        return read ? ["categories", "stats"] : "categories";
    if (route.includes("menu-inventory-components"))
        return "inventory";
    if (route.includes("/menus"))
        return read ? ["menu", "kitchen", "inventory", "stats", "close-shop"] : "menu";
    if (route.includes("hidden-bills") || route.includes("/bills/"))
        return "bills";
    if (route.includes("/tables/") && /(request-check|settle|transfer)$/.test(route))
        return "bills";
    if (route.includes("/tables") || route.includes("/zones"))
        return read ? ["tables", "kitchen", "stats"] : "tables";
    if (route.includes("call-staff"))
        return ["kitchen", "tables"];
    if (route.includes("/chat"))
        return ["tables", "kitchen"];
    if (route.includes("/orders")) {
        if (read)
            return ["orders", "kitchen", "bills", "stats", "close-shop"];
        // Food preparation actions belong to the kitchen; order editing belongs to Orders.
        if (/\/orders\/[^/]+\/(accept|status|items\/[^/]+\/(resolve|confirm))$/.test(route))
            return "kitchen";
        return "orders";
    }
    if (route.includes("stock-deposits"))
        return "stock-deposits";
    if (route.includes("/stock/"))
        return "inventory";
    if (route.includes("/finance"))
        return read ? ["finance", "backend"] : "finance";
    if (route.includes("/audit"))
        return "audit";
    if (route.includes("/feedback"))
        return "feedback";
    return null;
}
