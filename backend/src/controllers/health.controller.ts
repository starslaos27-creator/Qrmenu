

export function createHealthController(app, env) {
  const get_health = async () => ({
        ok: true,
        service: "shopqr-backend",
        env: env.nodeEnv,
        time: new Date().toISOString(),
    });
  const get_ready = async (request, reply) => {
    if (!app.db) {
      return reply.code(503).send({ ok: false, error: "DATABASE_NOT_CONFIGURED" });
    }
    try {
      await app.db.query("select 1");
      return { ok: true, service: "shopqr-backend", database: "ready" };
    } catch (error) {
      request.log.warn({ err: error }, "database readiness check failed");
      return reply.code(503).send({ ok: false, error: "DATABASE_UNAVAILABLE" });
    }
  };
  return { get_health, get_ready };
}


