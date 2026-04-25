import { Hono } from "hono";
import { serveStatic } from "hono/bun";
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

app.route("/", authRoutes);

type AuthVars = { Variables: { user: { id: string; username: string } } };
const protectedRoutes = new Hono<AuthVars>();
protectedRoutes.use("*", authMiddleware);
protectedRoutes.route("/", groups);
protectedRoutes.route("/", coinRoutes);
protectedRoutes.route("/", movementRoutes);
protectedRoutes.route("/", settingsRoutes);
app.route("/", protectedRoutes);

const port = Number(Bun.env["PORT"]) || 3000;

console.log(`Crypto Tracker running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
