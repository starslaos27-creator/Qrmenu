import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
async function main() {
    const env = loadEnv();
    const app = await createApp(env);
    await app.listen({ host: env.host, port: env.port });
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
