import { requireAuth } from "../security/auth.js";
export async function requirePlatformAdmin(request, reply, env, allowedRoles = undefined) {
    const user = await requireAuth(request, reply, env);
    if (!user)
        return null;
    if (!request.server.db) {
        await reply.status(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
        return null;
    }
    const result = await request.server.db.query(`select a.role, a.active, a.section_permissions, u.disabled_at
     from app_admins a
     join app_users u on u.id = a.user_id
     where a.user_id = $1
     limit 1`, [user.id]);
    const admin = result.rows[0];
    if (!admin || !admin.active || admin.disabled_at) {
        await reply.status(403).send({ ok: false, error: "ADMIN_FORBIDDEN" });
        return null;
    }
    const section = adminSectionForRoute(request);
    const permissions = admin.section_permissions;
    const isAdminAccessChange = request.routeOptions?.url === "/api/admin/users/:userId/admin-access";
    const isAdminAccessList = request.routeOptions?.url === "/api/admin/users" && request.method === "GET";
    const isUserDelete = request.routeOptions?.url === "/api/admin/users/:userId" && request.method === "DELETE";
    if (isUserDelete && admin.role !== "super_admin") {
        await reply.status(403).send({ ok: false, error: "ADMIN_FORBIDDEN" });
        return null;
    }
    if ((isAdminAccessChange || isAdminAccessList) && !["super_admin", "support"].includes(admin.role)) {
        await reply.status(403).send({ ok: false, error: "ADMIN_FORBIDDEN" });
        return null;
    }
    if (permissions && request.routeOptions?.url !== "/api/admin/me" && !isAdminAccessChange && !isAdminAccessList && !isUserDelete) {
        const required = ["GET", "HEAD", "OPTIONS"].includes(request.method) ? "view" : "edit";
        const permitted = (Array.isArray(section) ? section : [section]).some((candidate) => {
          const permission = permissions[candidate];
          return permission === "edit" || (required === "view" && permission === "view");
        });
        if (!section || !permitted) {
            await reply.status(403).send({ ok: false, error: "ADMIN_SECTION_FORBIDDEN" });
            return null;
        }
    } else if (allowedRoles && !allowedRoles.includes(admin.role)) {
        await reply.status(403).send({ ok: false, error: "ADMIN_FORBIDDEN" });
        return null;
    }
    return { user, role: admin.role, sectionPermissions: permissions || null };
}

function adminSectionForRoute(request) {
    const route = request.routeOptions?.url || request.url.split("?")[0];
    if (route.startsWith("/api/admin/users")) return "users";
    if (route.startsWith("/api/admin/finance")) return `finance-${request.query?.kind || request.body?.kind || "income"}`;
    if (route.startsWith("/api/admin/audit-logs")) return "audit";
    if (route.startsWith("/api/admin/contact-messages")) return "contact-messages";
    if (route.startsWith("/api/admin/pro-pricing")) return request.method === "GET" ? ["pro-pricing", "shops"] : "pro-pricing";
    if (route.startsWith("/api/admin/pro-payment-")) return "settings";
    if (route.startsWith("/api/admin/pro-requests") || route.startsWith("/api/admin/order-fee-") || route.includes("order-fee-requests") || route.includes("pro-purchases") || route.includes("active-pro-packages") || route.includes("order-bills-summary") || route.startsWith("/api/admin/pro-exchange-rate")) return "shops";
    if (route.startsWith("/api/admin/restaurants")) return "shops";
    if (route.startsWith("/api/admin/summary")) return ["overview", "monitor"];
    return null;
}
