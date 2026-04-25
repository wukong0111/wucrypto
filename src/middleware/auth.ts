import { getCookie } from "hono/cookie";
import { deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { validateSession } from "../lib/auth";

type AuthEnv = {
  Variables: { user: { id: string; username: string } };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, "session_token");
  if (!token) return c.redirect("/login");
  const user = await validateSession(token);
  if (!user) {
    deleteCookie(c, "session_token", { path: "/" });
    return c.redirect("/login");
  }
  c.set("user", user);
  await next();
});
