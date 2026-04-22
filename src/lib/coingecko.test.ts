import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { clearCache, fetchPrices, searchCoins } from "./coingecko";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearCache();
  // @ts-expect-error Bun's fetch type has extra properties that mock doesn't provide
  globalThis.fetch = mock(() => Promise.resolve(new Response("not found", { status: 404 })));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetchResponse(data: unknown, status = 200): void {
  // @ts-expect-error same as above
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("fetchPrices", () => {
  test("returns prices from API", async () => {
    mockFetchResponse({ bitcoin: { usd: 50000 }, ethereum: { usd: 3000 } });
    const prices = await fetchPrices(["bitcoin", "ethereum"]);
    expect(prices.get("bitcoin")).toBe(50000);
    expect(prices.get("ethereum")).toBe(3000);
  });

  test("returns nulls on API error", async () => {
    // @ts-expect-error same as above
    globalThis.fetch = mock(() => Promise.resolve(new Response("error", { status: 500 })));
    const prices = await fetchPrices(["bitcoin"]);
    expect(prices.get("bitcoin")).toBeNull();
  });

  test("returns nulls on network error", async () => {
    // @ts-expect-error same as above
    globalThis.fetch = mock(() => Promise.reject(new Error("network")));
    const prices = await fetchPrices(["bitcoin"]);
    expect(prices.get("bitcoin")).toBeNull();
  });

  test("returns empty map for empty ids", async () => {
    const prices = await fetchPrices([]);
    expect(prices.size).toBe(0);
  });

  test("caches results within TTL", async () => {
    mockFetchResponse({ bitcoin: { usd: 50000 } });
    const p1 = await fetchPrices(["bitcoin"]);
    const p2 = await fetchPrices(["bitcoin"]);
    expect(p1.get("bitcoin")).toBe(50000);
    expect(p2.get("bitcoin")).toBe(50000);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("searchCoins", () => {
  test("returns search results", async () => {
    mockFetchResponse({
      coins: [
        { id: "bitcoin", symbol: "btc", name: "Bitcoin" },
        { id: "bitcoin-cash", symbol: "bch", name: "Bitcoin Cash" },
      ],
    });
    const results = await searchCoins("bit");
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe("bitcoin");
  });

  test("returns empty on API error", async () => {
    // @ts-expect-error same as above
    globalThis.fetch = mock(() => Promise.reject(new Error("fail")));
    const results = await searchCoins("bit");
    expect(results).toHaveLength(0);
  });

  test("returns empty for empty query", async () => {
    const results = await searchCoins("");
    expect(results).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("limits to 10 results", async () => {
    const coins = Array.from({ length: 15 }, (_, i) => ({
      id: `coin-${i}`,
      symbol: `C${i}`,
      name: `Coin ${i}`,
    }));
    mockFetchResponse({ coins });
    const results = await searchCoins("coin");
    expect(results).toHaveLength(10);
  });
});
