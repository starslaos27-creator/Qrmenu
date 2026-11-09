import { createAuthController } from "../controllers/auth.controller.js";
export async function registerAuthRoutes(app, env) {
    const controller = createAuthController(app, env);
    app.post("/api/auth/signup", controller.post_api_auth_signup);
    app.post("/api/auth/login", controller.post_api_auth_login);
    app.post("/api/auth/refresh", controller.post_api_auth_refresh);
    app.post("/api/auth/logout", controller.post_api_auth_logout);
    app.get("/api/auth/me", controller.get_api_auth_me);
    app.post("/api/auth/change-password", controller.post_api_auth_change_password);
    app.get("/api/auth/invites/:token", controller.get_api_auth_invites_token);
    app.post("/api/auth/accept-invite", controller.post_api_auth_accept_invite);
    app.post("/api/auth/forgot-password", controller.post_api_auth_forgot_password);
    app.get("/api/auth/password-reset/:token", controller.get_api_auth_password_reset_token);
    app.post("/api/auth/reset-password", controller.post_api_auth_reset_password);
}
