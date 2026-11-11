import { createAuthController } from "../controllers/auth.controller.js";
export async function registerAuthRoutes(app, env) {
    const controller = createAuthController(app, env);
    if (app.db) {
        let suspending = false;
        const suspendLongInactiveAccounts = async () => {
            if (suspending)
                return;
            suspending = true;
            let client;
            try {
                client = await app.db.connect();
                await client.query("begin");
                const result = await client.query(`with suspended as (
          update app_users u
          set disabled_at = now(),
              disabled_reason = 'AUTOMATIC_INACTIVITY_365_DAYS',
              updated_at = now()
          where u.disabled_at is null
            and u.last_activity_at < now() - interval '365 days'
            and u.inactivity_suspension_eligible_at <= now()
            and not exists (
              select 1 from app_admins a
              where a.user_id = u.id and a.active = true
            )
          returning u.id, u.email, u.last_activity_at
        ), revoked as (
          update auth_refresh_sessions s
          set revoked_at = coalesce(s.revoked_at, now())
          from suspended x
          where s.user_id = x.id and s.revoked_at is null
          returning s.id
        )
        insert into platform_admin_audit_logs
          (action, target_type, target_id, reason, details)
        select 'user.auto_suspend_inactive', 'user', id,
               'ไม่มีการเคลื่อนไหวเกิน 365 วัน',
               jsonb_build_object('email', email, 'last_activity_at', last_activity_at)
        from suspended`);
                await client.query("commit");
                if (result.rowCount) {
                    app.log.info({ count: result.rowCount }, "Automatically suspended inactive accounts");
                }
            }
            catch (error) {
                if (client)
                    await client.query("rollback").catch(() => { });
                app.log.error({ err: error }, "Could not suspend inactive accounts");
            }
            finally {
                client?.release();
                suspending = false;
            }
        };
        void suspendLongInactiveAccounts();
        const inactivityTimer = setInterval(() => void suspendLongInactiveAccounts(), 60 * 60 * 1000);
        inactivityTimer.unref?.();
        app.addHook("onClose", async () => clearInterval(inactivityTimer));
    }
    app.post("/api/auth/signup", controller.post_api_auth_signup);
    app.post("/api/auth/login", controller.post_api_auth_login);
    app.post("/api/auth/refresh", controller.post_api_auth_refresh);
    app.post("/api/auth/logout", controller.post_api_auth_logout);
    app.get("/api/auth/me", controller.get_api_auth_me);
    app.post("/api/auth/activity", controller.post_api_auth_activity);
    app.post("/api/auth/change-password", controller.post_api_auth_change_password);
    app.get("/api/auth/invites/:token", controller.get_api_auth_invites_token);
    app.post("/api/auth/accept-invite", controller.post_api_auth_accept_invite);
    app.post("/api/auth/forgot-password", controller.post_api_auth_forgot_password);
    app.get("/api/auth/password-reset/:token", controller.get_api_auth_password_reset_token);
    app.post("/api/auth/reset-password", controller.post_api_auth_reset_password);
}
