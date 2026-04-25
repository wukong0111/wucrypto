import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { createSession, deleteSession, hashPassword, verifyPassword } from "../lib/auth";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import LoginView from "../views/login";
import RegisterView from "../views/register";

const auth = new Hono();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
};

auth.get("/login", (c) => {
  return c.html(<LoginView />);
});

auth.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body["username"] ?? "").trim();
  const password = String(body["password"] ?? "");

  if (!username || !password) {
    return c.html(<LoginView error="Username and password are required" />);
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.html(<LoginView error="Invalid username or password" />);
  }

  const token = await createSession(user.id);
  setCookie(c, "session_token", token, COOKIE_OPTS);
  return c.redirect("/");
});

auth.get("/register", (c) => {
  return c.html(<RegisterView />);
});

auth.post("/register", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body["username"] ?? "").trim();
  const password = String(body["password"] ?? "");

  if (!username || !password) {
    return c.html(<RegisterView error="Username and password are required" />);
  }

  if (username.length < 3 || username.length > 50 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.html(
      <RegisterView error="Username must be 3-50 characters (letters, numbers, underscore)" />,
    );
  }

  if (password.length < 8) {
    return c.html(<RegisterView error="Password must be at least 8 characters" />);
  }

  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    return c.html(<RegisterView error="Username already taken" />);
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ username, passwordHash }).returning();
  if (!user) return c.html(<RegisterView error="Failed to create user" />, 500);

  const token = await createSession(user.id);
  setCookie(c, "session_token", token, COOKIE_OPTS);
  return c.redirect("/");
});

auth.post("/logout", async (c) => {
  const { getCookie: gc } = await import("hono/cookie");
  const token = gc(c, "session_token");
  if (token) await deleteSession(token);
  deleteCookie(c, "session_token", { path: "/" });
  return c.redirect("/login");
});

export default auth;
