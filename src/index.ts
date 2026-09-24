import { Hono } from "hono";
import { corsMiddleware, handleGlobalError } from "./server/middleware";
import { createApiRoutes, type RoutesConfig } from "./server/routes";

export function createFreebuffApp(config: RoutesConfig = {}): Hono {
  const app = new Hono();

  // Middleware
  app.use("*", corsMiddleware);
  app.onError((err, c) => handleGlobalError(err, c));

  // Mount API Routes
  const apiRouter = createApiRoutes(config);
  app.route("/", apiRouter);

  return app;
}

export default createFreebuffApp();
