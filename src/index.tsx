import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import coinRoutes from "./routes/coins";
import groups from "./routes/groups";
import movementRoutes from "./routes/movements";

const app = new Hono();

app.use("/app.css", serveStatic({ root: "./public" }));
app.use("/htmx.min.js", serveStatic({ root: "./public" }));

app.route("/", groups);
app.route("/", coinRoutes);
app.route("/", movementRoutes);

const port = Number(Bun.env["PORT"]) || 3000;

console.log(`Crypto Tracker running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
