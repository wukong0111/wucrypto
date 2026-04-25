import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { deleteAllUserSessions, hashPassword, verifyPassword } from "../lib/auth";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { FormError } from "../views/components/FormError";
import SettingsView from "../views/settings";

const settings = new Hono<{
  Variables: { user: { id: string; username: string } };
}>();

settings.get("/settings", async (c) => {
  const user = c.get("user");
  return c.html(<SettingsView username={user.username} />);
});

settings.post("/settings/username", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const newUsername = String(body["username"] ?? "").trim();

  if (!newUsername) {
    c.header("HX-Retarget", "#username-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Username is required</span>, 400);
  }

  if (newUsername.length < 3 || newUsername.length > 50 || !/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    c.header("HX-Retarget", "#username-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(
      <span>Username must be 3-50 characters (letters, numbers, underscore)</span>,
      400,
    );
  }

  const [existing] = await db.select().from(users).where(eq(users.username, newUsername)).limit(1);
  if (existing && existing.id !== user.id) {
    c.header("HX-Retarget", "#username-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Username already taken</span>, 400);
  }

  await db.update(users).set({ username: newUsername }).where(eq(users.id, user.id));

  return c.html(
    <div id="username-section" class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
        Change Username
      </h2>
      <p class="text-sm text-gray-400 mb-3">
        Current: <span class="text-white">{newUsername}</span>
      </p>
      <form
        hx-post="/settings/username"
        hx-target="#username-section"
        hx-swap="outerHTML"
        data-err="username-error"
        class="flex gap-2 items-end"
      >
        <div class="flex-1">
          <label
            for="new-username"
            class="block text-xs text-gray-500 mb-1 uppercase tracking-wide"
          >
            New Username
          </label>
          <input
            id="new-username"
            type="text"
            name="username"
            required
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          class="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Update
        </button>
      </form>
      <div id="username-error" class="text-green-400 text-sm mt-2 min-h-[1.25rem]">
        Username updated!
      </div>
    </div>,
  );
});

settings.post("/settings/password", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const currentPassword = String(body["currentPassword"] ?? "");
  const newPassword = String(body["newPassword"] ?? "");

  if (!currentPassword || !newPassword) {
    c.header("HX-Retarget", "#password-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Both fields are required</span>, 400);
  }

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    c.header("HX-Retarget", "#password-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Current password is incorrect</span>, 400);
  }

  if (newPassword.length < 8) {
    c.header("HX-Retarget", "#password-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>New password must be at least 8 characters</span>, 400);
  }

  const newHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
  await deleteAllUserSessions(user.id);
  deleteCookie(c, "session_token", { path: "/" });

  c.header("HX-Redirect", "/login");
  return c.text("", 200);
});

export default settings;
