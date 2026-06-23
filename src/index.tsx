import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { apiKeyMiddleware } from "./middleware/api-key";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import coinRoutes from "./routes/coins";
import groups from "./routes/groups";
import movementRoutes from "./routes/movements";
import settingsRoutes from "./routes/settings";

const app = new Hono();

app.use("/favicon.svg", serveStatic({ root: "./public" }));
app.use("/app.css", serveStatic({ root: "./public" }));
app.use("/htmx.min.js", serveStatic({ root: "./public" }));
app.use("/movement-calc.js", serveStatic({ root: "./public" }));
app.use("/sort-coins.js", serveStatic({ root: "./public" }));

app.route("/", authRoutes);

type AuthVars = { Variables: { user: { id: string; username: string } } };
const protectedRoutes = new Hono<AuthVars>();
protectedRoutes.use("*", authMiddleware);
protectedRoutes.use("*", apiKeyMiddleware);
protectedRoutes.route("/", groups);
protectedRoutes.route("/", coinRoutes);
protectedRoutes.route("/", movementRoutes);
protectedRoutes.route("/", settingsRoutes);
app.route("/", protectedRoutes);

const port = Number(Bun.env["PORT"]) || 3000;

const fetchWithDoctype: typeof app.fetch = async (request, env, executionCtx) => {
  const response = await app.fetch(request, env, executionCtx);
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }
  const clone = response.clone();
  const body = await clone.text();
  if (body.startsWith("<!DOCTYPE") || !body.includes("<html")) {
    return response;
  }
  return new Response(`<!DOCTYPE html>\n${body}`, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

console.log(`Crypto Tracker running on http://localhost:${port}`);

export default {
  port,
  fetch: fetchWithDoctype,
};
