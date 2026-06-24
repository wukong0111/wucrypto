import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { createSession } from "../lib/auth";
import { clearCache } from "../lib/coingecko";
import { createTestUser, createTestUserWithoutApiKey, truncateAll } from "../lib/test-helpers";
import { apiKeyMiddleware } from "../middleware/api-key";
import { authMiddleware } from "../middleware/auth";
import authRoute from "./auth";
import coinsRoute from "./coins";
import groupsRoute from "./groups";
import movementsRoute from "./movements";
import settingsRoute from "./settings";

type AuthVars = {
  Variables: { user: { id: string; username: string; coingeckoApiKey: string | null } };
};

let userId: string;
let username: string;
let sessionToken: string;

const originalFetch = globalThis.fetch;

function createApp(): Hono {
  const app = new Hono();
  app.route("/", authRoute);
  const protectedRoutes = new Hono<AuthVars>();
  protectedRoutes.use("*", authMiddleware);
  protectedRoutes.use("*", apiKeyMiddleware);
  protectedRoutes.route("/", groupsRoute);
  protectedRoutes.route("/", coinsRoute);
  protectedRoutes.route("/", movementsRoute);
  protectedRoutes.route("/", settingsRoute);
  app.route("/", protectedRoutes);
  return app;
}

beforeEach(async () => {
  await truncateAll();
  const user = await createTestUser();
  userId = user.id;
  username = user.username;
  sessionToken = await createSession(userId);
  clearCache();
  mockCoinGeckoFetch({ bitcoin: { usd: 50000 }, ethereum: { usd: 3000 } }, [
    { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
    { id: "ethereum", symbol: "eth", name: "Ethereum" },
  ]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withAuth(): { Cookie: string } {
  return { Cookie: `session_token=${sessionToken}` };
}

function mockCoinGeckoFetch(
  prices: Record<string, { usd: number }>,
  coinList: Array<{ id: string; symbol: string; name: string }>,
): void {
  // @ts-expect-error Bun's fetch type has extra properties that mock doesn't provide
  globalThis.fetch = mock((url: string) => {
    if (url.includes("/simple/price")) {
      return Promise.resolve(
        new Response(JSON.stringify(prices), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (url.includes("/coins/list")) {
      return Promise.resolve(
        new Response(JSON.stringify(coinList), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  });
}

describe("GET / (home)", () => {
  test("returns HTML with title when authenticated", async () => {
    const app = createApp();
    const res = await app.request("/", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Wucrypto");
  });

  test("redirects to login when not authenticated", async () => {
    const app = createApp();
    const res = await app.request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  test("shows empty state", async () => {
    const app = createApp();
    const res = await app.request("/", { headers: withAuth() });
    const html = await res.text();
    expect(html).toContain("No groups yet");
  });
});

describe("POST /groups", () => {
  test("creates a group", async () => {
    const app = createApp();
    const res = await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Long+Term",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Long Term");
    expect(html).toContain("long-term");
  });

  test("rejects empty name", async () => {
    const app = createApp();
    const res = await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=",
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /groups/:groupId", () => {
  test("deletes a group", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    const res = await app.request("/groups/test", {
      method: "DELETE",
      headers: withAuth(),
    });
    expect(res.status).toBe(200);
    const resHtml = await res.text();
    expect(resHtml).toContain("Se ha eliminado el grupo Test");
    const listRes = await app.request("/", { headers: withAuth() });
    const listHtml = await listRes.text();
    expect(listHtml).not.toContain("Test");
  });
});

describe("GET /groups/:groupId", () => {
  test("returns group detail page", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=My+Portfolio",
    });
    const res = await app.request("/groups/my-portfolio", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("My Portfolio");
    expect(html).toContain("No coins");
  });

  test("returns 404 for unknown group", async () => {
    const app = createApp();
    const res = await app.request("/groups/nope", { headers: withAuth() });
    expect(res.status).toBe(404);
  });

  test("shows update banner when CoinGecko metadata changed", async () => {
    mockCoinGeckoFetch({ "the-open-network": { usd: 5 } }, [
      { id: "the-open-network", symbol: "gram", name: "Gram (prev. Toncoin)" },
    ]);
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=the-open-network&symbol=TON&name=Toncoin",
    });
    const res = await app.request("/groups/test", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Toncoin (TON)");
    expect(html).toContain("Gram (prev. Toncoin) (GRAM)");
    expect(html).toContain("coin-meta-alert-the-open-network");
    expect(html).toContain('hx-put="/groups/test/coins/the-open-network"');
  });

  test("does not show banner when metadata matches", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("coin-meta-alert");
  });

  test("renders group detail when metadata fetch fails", async () => {
    // @ts-expect-error same as above
    globalThis.fetch = mock((url: string) => {
      if (url.includes("/simple/price")) {
        return Promise.resolve(
          new Response(JSON.stringify({ bitcoin: { usd: 50000 } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("error", { status: 500 }));
    });
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bitcoin");
    expect(html).not.toContain("coin-meta-alert");
  });
});

describe("PUT /groups/:groupId/coins/:coinId", () => {
  test("updates stored symbol and name", async () => {
    mockCoinGeckoFetch({ "the-open-network": { usd: 5 } }, [
      { id: "the-open-network", symbol: "gram", name: "Gram (prev. Toncoin)" },
    ]);
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=the-open-network&symbol=TON&name=Toncoin",
    });
    const res = await app.request("/groups/test/coins/the-open-network", {
      method: "PUT",
      headers: withAuth(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="coin-meta-alert-the-open-network" hidden');
    expect(html).toContain("Gram (prev. Toncoin)");
    expect(html).toContain("GRAM");

    const detailRes = await app.request("/groups/test/coins/the-open-network", {
      headers: withAuth(),
    });
    const detailHtml = await detailRes.text();
    expect(detailHtml).toContain("Gram (prev. Toncoin)");
    expect(detailHtml).toContain("GRAM");
    expect(detailHtml).not.toContain(">TON<");
  });

  test("returns inline error when live metadata unavailable", async () => {
    // @ts-expect-error same as above
    globalThis.fetch = mock(() => Promise.resolve(new Response("error", { status: 500 })));
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin", {
      method: "PUT",
      headers: withAuth(),
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Unable to fetch current CoinGecko metadata");
  });
});

describe("POST /groups/:groupId/coins", () => {
  test("adds a coin to group", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    const res = await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bitcoin");
  });

  test("rejects missing coinId", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    const res = await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=&symbol=&name=",
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /groups/:groupId/coins/:coinId", () => {
  test("removes a coin", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin", {
      method: "DELETE",
      headers: withAuth(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Se ha eliminado la moneda Bitcoin");
  });
});

describe("POST /groups/:groupId/coins/:coinId/movements", () => {
  test("adds a buy movement", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "type=buy&date=2026-01-15T09:30&amount=0.5&pricePerCoin=40000&note=test",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("BUY");
  });

  test("rejects invalid data", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "type=buy&date=&amount=abc&pricePerCoin=&note=",
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /groups/:groupId/coins/:coinId/movements/:movId", () => {
  test("deletes a movement", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const movRes = await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "type=buy&date=2026-01-15T09:30&amount=1&pricePerCoin=50000&note=",
    });
    const movHtml = await movRes.text();
    const idMatch = movHtml.match(/id="mov-([^"]+)"/);
    const movId = idMatch?.[1];
    expect(movId).toBeDefined();

    const res = await app.request(`/groups/test/coins/bitcoin/movements/${movId}`, {
      method: "DELETE",
      headers: withAuth(),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Se ha eliminado el movimiento");
  });
});

describe("GET /groups/:groupId/coins/:coinId", () => {
  test("shows coin detail with movements", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...withAuth() },
      body: "type=buy&date=2026-01-15T09:30&amount=1&pricePerCoin=40000&note=first buy",
    });
    const res = await app.request("/groups/test/coins/bitcoin", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bitcoin");
    expect(html).toContain("first buy");
    expect(html).toContain("$50,000.00");
  });
});

describe("GET /api/coins/search", () => {
  test("returns search results as HTML", async () => {
    // @ts-expect-error mock
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            coins: [{ id: "bitcoin", symbol: "btc", name: "Bitcoin" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const app = createApp();
    const res = await app.request("/api/coins/search?q=bit", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bitcoin");
  });

  test("returns empty for empty query", async () => {
    const app = createApp();
    const res = await app.request("/api/coins/search?q=", { headers: withAuth() });
    expect(res.status).toBe(200);
  });
});

describe("auth", () => {
  test("GET /login renders login page", async () => {
    const app = createApp();
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Log in to Wucrypto");
  });

  test("GET /register renders register page", async () => {
    const app = createApp();
    const res = await app.request("/register");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Create account");
  });

  test("POST /register creates user and redirects to settings when api key is missing", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=newuser&password=password123",
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/settings?error=missing_key");
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("session_token=");
  });

  test("POST /register rejects short username", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=ab&password=password123",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("3-50 characters");
  });

  test("POST /register rejects short password", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=testuser2&password=short",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("at least 8 characters");
  });

  test("POST /login with valid credentials redirects", async () => {
    const app = createApp();
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${username}&password=testpass123`,
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  test("POST /login with invalid credentials shows error", async () => {
    const app = createApp();
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${username}&password=wrongpassword`,
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid username or password");
  });

  test("POST /logout clears session and redirects", async () => {
    const app = createApp();
    const res = await app.request("/logout", {
      method: "POST",
      headers: withAuth(),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });
});

describe("settings", () => {
  test("GET /settings renders settings page", async () => {
    const app = createApp();
    const res = await app.request("/settings", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Change Username");
    expect(html).toContain("Change Password");
  });

  test("GET /settings redirects to login when not authenticated", async () => {
    const app = createApp();
    const res = await app.request("/settings");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  test("POST /settings/username updates username", async () => {
    const app = createApp();
    const res = await app.request("/settings/username", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "username=newusername",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("newusername");
    expect(html).toContain("Username updated!");
  });

  test("POST /settings/username rejects short username", async () => {
    const app = createApp();
    const res = await app.request("/settings/username", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "username=ab",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("3-50 characters");
  });

  test("POST /settings/username rejects taken username", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=otheruser&password=password123",
      redirect: "manual",
    });
    expect(res.status).toBe(302);

    const res2 = await app.request("/settings/username", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "username=otheruser",
    });
    expect(res2.status).toBe(400);
    const html = await res2.text();
    expect(html).toContain("already taken");
  });

  test("POST /settings/password invalidates sessions and redirects", async () => {
    const app = createApp();
    const res = await app.request("/settings/password", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "currentPassword=testpass123&newPassword=newpassword123",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("HX-Redirect")).toBe("/login");

    const res2 = await app.request("/", { headers: withAuth() });
    expect(res2.status).toBe(302);
    expect(res2.headers.get("Location")).toBe("/login");
  });

  test("POST /settings/password rejects wrong current password", async () => {
    const app = createApp();
    const res = await app.request("/settings/password", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "currentPassword=wrongpassword&newPassword=newpassword123",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Current password is incorrect");
  });

  test("POST /settings/password rejects short new password", async () => {
    const app = createApp();
    const res = await app.request("/settings/password", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "currentPassword=testpass123&newPassword=short",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("at least 8 characters");
  });

  test("GET /settings shows missing key error banner", async () => {
    const app = createApp();
    const res = await app.request("/settings?error=missing_key", { headers: withAuth() });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("API Key required");
  });

  test("POST /settings/coingecko-key saves valid key", async () => {
    // @ts-expect-error mock
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
    );
    const app = createApp();
    const res = await app.request("/settings/coingecko-key", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "apiKey=valid-key-123",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("API key updated");
  });

  test("POST /settings/coingecko-key rejects invalid key", async () => {
    // @ts-expect-error mock
    globalThis.fetch = mock(() => Promise.resolve(new Response("unauthorized", { status: 401 })));
    const app = createApp();
    const res = await app.request("/settings/coingecko-key", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
        "HX-Request": "true",
      },
      body: "apiKey=invalid-key",
    });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Invalid API key");
  });

  test("POST /settings/coingecko-key clears key when empty", async () => {
    const app = createApp();
    const res = await app.request("/settings/coingecko-key", {
      method: "POST",
      headers: {
        ...withAuth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "apiKey=",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Not configured");
  });
});

describe("api key enforcement", () => {
  test("redirects to settings when api key is missing on group detail", async () => {
    await truncateAll();
    const user = await createTestUserWithoutApiKey();
    const token = await createSession(user.id);

    const app = createApp();
    const res = await app.request("/groups/test", {
      headers: { Cookie: `session_token=${token}` },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/settings?error=missing_key");
  });

  test("redirects to settings when api key is missing on coin detail", async () => {
    await truncateAll();
    const user = await createTestUserWithoutApiKey();
    const token = await createSession(user.id);

    const app = createApp();
    const res = await app.request("/groups/test/coins/bitcoin", {
      headers: { Cookie: `session_token=${token}` },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/settings?error=missing_key");
  });

  test("returns inline error for HTMX search without api key", async () => {
    await truncateAll();
    const user = await createTestUserWithoutApiKey();
    const token = await createSession(user.id);

    const app = createApp();
    const res = await app.request("/api/coins/search?q=bit", {
      headers: { Cookie: `session_token=${token}`, "HX-Request": "true" },
    });
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).toContain("Configure your CoinGecko API key");
  });

  test("redirects to settings when api key is missing on home", async () => {
    await truncateAll();
    const user = await createTestUserWithoutApiKey();
    const token = await createSession(user.id);

    const app = createApp();
    const res = await app.request("/", {
      headers: { Cookie: `session_token=${token}` },
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/settings?error=missing_key");
  });

  test("exempt routes work without api key", async () => {
    await truncateAll();
    const user = await createTestUserWithoutApiKey();
    const token = await createSession(user.id);

    const app = createApp();
    const res = await app.request("/groups", {
      method: "POST",
      headers: {
        Cookie: `session_token=${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=testgroup",
    });
    expect(res.status).toBe(200);
  });
});
