const TTL_MS = 60_000;
const METADATA_TTL_MS = 300_000;
const BASE_URL = "https://api.coingecko.com/api/v3";

const cache = new Map<string, { ts: number; ttl: number; data: Promise<unknown> }>();

export function clearCache(): void {
  cache.clear();
}

function getCached<T>(key: string, fetcher: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttl) {
    return entry.data as Promise<T>;
  }
  const data = fetcher();
  cache.set(key, { ts: Date.now(), ttl, data });
  return data;
}

function headers(apiKey: string): Record<string, string> {
  return { "x-cg-demo-api-key": apiKey };
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (Bun.env["MOCK_COINGECKO_API_KEY"] && apiKey === Bun.env["MOCK_COINGECKO_API_KEY"]) {
    return true;
  }
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

export type CoinMetadata = { symbol: string; name: string };

export async function fetchCoinMetadata(
  coinIds: string[],
  apiKey: string,
): Promise<Map<string, CoinMetadata | null>> {
  if (coinIds.length === 0) return new Map();

  const all = await getCached(
    "metadata:list",
    async () => {
      const result = new Map<string, CoinMetadata>();
      try {
        const url = `${BASE_URL}/coins/list`;
        const res = await fetch(url, { headers: headers(apiKey) });
        if (!res.ok) return result;
        const json = (await res.json()) as Array<{ id: string; symbol: string; name: string }>;
        for (const item of json) {
          result.set(item.id, { symbol: item.symbol, name: item.name });
        }
      } catch {
        // network error — return empty map
      }
      return result;
    },
    METADATA_TTL_MS,
  );

  const filtered = new Map<string, CoinMetadata | null>();
  for (const id of coinIds) {
    filtered.set(id, all.get(id) ?? null);
  }
  return filtered;
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
