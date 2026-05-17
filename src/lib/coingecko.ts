const TTL_MS = 60_000;
const BASE_URL = "https://api.coingecko.com/api/v3";

const cache = new Map<string, { ts: number; data: Promise<unknown> }>();

export function clearCache(): void {
  cache.clear();
}

function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < TTL_MS) {
    return entry.data as Promise<T>;
  }
  const data = fetcher();
  cache.set(key, { ts: Date.now(), data });
  return data;
}

function headers(apiKey: string): Record<string, string> {
  return { "x-cg-demo-api-key": apiKey };
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const url = `${BASE_URL}/ping`;
    const res = await fetch(url, { headers: headers(apiKey) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchPrices(
  coinIds: string[],
  apiKey: string,
): Promise<Map<string, number | null>> {
  if (coinIds.length === 0) return new Map();

  const sorted = [...coinIds].sort();
  const cacheKey = `prices:${sorted.join(",")}`;

  return getCached(cacheKey, async () => {
    const result = new Map<string, number | null>();
    for (const id of coinIds) result.set(id, null);

    try {
      const url = `${BASE_URL}/simple/price?ids=${sorted.join(",")}&vs_currencies=usd`;
      const res = await fetch(url, { headers: headers(apiKey) });
      if (!res.ok) return result;
      const json = (await res.json()) as Record<string, { usd?: number }>;
      for (const [id, price] of Object.entries(json)) {
        result.set(id, price.usd ?? null);
      }
    } catch {
      // network error — return nulls
    }
    return result;
  });
}

export async function searchCoins(
  query: string,
  apiKey: string,
): Promise<Array<{ id: string; symbol: string; name: string }>> {
  if (!query.trim()) return [];

  try {
    const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: headers(apiKey) });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      coins?: Array<{ id: string; symbol: string; name: string }>;
    };
    return (json.coins ?? []).slice(0, 10).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
    }));
  } catch {
    return [];
  }
}
