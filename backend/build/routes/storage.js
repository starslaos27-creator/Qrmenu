import { createStorageController } from "../controllers/storage.controller.js";
export async function registerStorageRoutes(app, env) {
    const controller = createStorageController(app, env);
    app.post("/api/storage/upload", controller.post_api_storage_upload);
}
