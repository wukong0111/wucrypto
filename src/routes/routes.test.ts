import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { clearCache } from "../lib/coingecko";
import coinsRoute from "./coins";
import groupsRoute from "./groups";
import movementsRoute from "./movements";

let testDir: string;
const origDataDir = Bun.env["DATA_DIR"];
const originalFetch = globalThis.fetch;

function createApp(): Hono {
  const app = new Hono();
  app.route("/", groupsRoute);
  app.route("/", coinsRoute);
  app.route("/", movementsRoute);
  return app;
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "wucrypto-test-"));
  Bun.env["DATA_DIR"] = testDir;
  clearCache();
  // @ts-expect-error Bun's fetch type has extra properties
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ bitcoin: { usd: 50000 }, ethereum: { usd: 3000 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(async () => {
  Bun.env["DATA_DIR"] = origDataDir;
  globalThis.fetch = originalFetch;
  await rm(testDir, { recursive: true, force: true });
});

describe("GET /", () => {
  test("returns HTML with title", async () => {
    const app = createApp();
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Wucrypto");
  });

  test("shows empty state", async () => {
    const app = createApp();
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain("No groups yet");
  });
});

describe("POST /groups", () => {
  test("creates a group", async () => {
    const app = createApp();
    const res = await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    const res = await app.request("/groups/test", { method: "DELETE" });
    expect(res.status).toBe(200);
    const listRes = await app.request("/");
    const html = await listRes.text();
    expect(html).not.toContain("Test");
  });
});

describe("GET /groups/:groupId", () => {
  test("returns group detail page", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=My+Portfolio",
    });
    const res = await app.request("/groups/my-portfolio");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("My Portfolio");
    expect(html).toContain("No coins");
  });

  test("returns 404 for unknown group", async () => {
    const app = createApp();
    const res = await app.request("/groups/nope");
    expect(res.status).toBe(404);
  });
});

describe("POST /groups/:groupId/coins", () => {
  test("adds a coin to group", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    const res = await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    const res = await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin", { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});

describe("POST /groups/:groupId/coins/:coinId/movements", () => {
  test("adds a buy movement", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const res = await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    const movRes = await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "type=buy&date=2026-01-15T09:30&amount=1&pricePerCoin=50000&note=",
    });
    const movHtml = await movRes.text();
    const idMatch = movHtml.match(/id="mov-([^"]+)"/);
    const movId = idMatch?.[1];
    expect(movId).toBeDefined();

    const res = await app.request(`/groups/test/coins/bitcoin/movements/${movId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /groups/:groupId/coins/:coinId", () => {
  test("shows coin detail with movements", async () => {
    const app = createApp();
    await app.request("/groups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Test",
    });
    await app.request("/groups/test/coins", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "coinId=bitcoin&symbol=BTC&name=Bitcoin",
    });
    await app.request("/groups/test/coins/bitcoin/movements", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "type=buy&date=2026-01-15T09:30&amount=1&pricePerCoin=40000&note=first buy",
    });
    const res = await app.request("/groups/test/coins/bitcoin");
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
    const res = await app.request("/api/coins/search?q=bit");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Bitcoin");
  });

  test("returns empty for empty query", async () => {
    const app = createApp();
    const res = await app.request("/api/coins/search?q=");
    expect(res.status).toBe(200);
  });
});
