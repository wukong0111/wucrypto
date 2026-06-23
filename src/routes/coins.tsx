import { Hono } from "hono";
import { calcGroupSummary, calcPnl } from "../lib/calc";
import { fetchCoinMetadata, fetchPrices, searchCoins } from "../lib/coingecko";
import { deleteCoin, getCoin, getGroup, listCoins, upsertCoin } from "../lib/storage";
import GroupDetailView, { CoinRow } from "../views/group-detail";
import Layout from "../views/layout";

const coins = new Hono<{
  Variables: { user: { id: string; username: string; coingeckoApiKey: string | null } };
}>();

coins.get("/groups/:groupId", async (c) => {
  const user = c.get("user");
  const { groupId } = c.req.param();
  const group = await getGroup(user.id, groupId);
  if (!group) return c.text("Group not found", 404);

  const apiKey = user.coingeckoApiKey;
  if (!apiKey) return c.redirect("/settings?error=missing_key");

  const coinList = await listCoins(user.id, groupId);
  const coinIds = coinList.map((coin) => coin.coinId);
  const [prices, metadata] = await Promise.all([
    fetchPrices(coinIds, apiKey),
    fetchCoinMetadata(coinIds, apiKey),
  ]);

  const derived = new Map<string, ReturnType<typeof calcPnl>>();
  const summaryInput: Array<{
    movements: (typeof coinList)[number]["movements"];
    priceUsd: number | null;
  }> = [];

  for (const coin of coinList) {
    const price = prices.get(coin.coinId) ?? null;
    const d = calcPnl(coin.movements, price);
    derived.set(coin.coinId, d);
    summaryInput.push({ movements: coin.movements, priceUsd: price });
  }

  const discrepancies = coinList
    .map((coin) => {
      const live = metadata.get(coin.coinId);
      if (!live) return null;
      const symbolChanged = coin.symbol.toLowerCase() !== live.symbol.toLowerCase();
      const nameChanged = coin.name.toLowerCase() !== live.name.toLowerCase();
      if (!symbolChanged && !nameChanged) return null;
      return {
        coinId: coin.coinId,
        symbol: coin.symbol,
        name: coin.name,
        liveSymbol: live.symbol,
        liveName: live.name,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const summary = calcGroupSummary(summaryInput);

  return c.html(
    <Layout title={group.name} username={user.username}>
      <GroupDetailView
        group={group}
        coins={coinList}
        derived={derived}
        summary={summary}
        prices={prices}
        discrepancies={discrepancies}
      />
    </Layout>,
  );
});

coins.post("/groups/:groupId/coins", async (c) => {
  const user = c.get("user");
  const { groupId } = c.req.param();
  const body = await c.req.parseBody();
  const coinId = String(body["coinId"] ?? "").trim();
  const symbol = String(body["symbol"] ?? "").trim();
  const name = String(body["name"] ?? "").trim();

  if (!coinId) {
    c.header("HX-Retarget", "#add-coin-error");
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span>Select a coin first</span>, 400);
  }

  const apiKey = user.coingeckoApiKey;
  if (!apiKey) return c.redirect("/settings?error=missing_key");

  const coin = { coinId, symbol, name, movements: [] };
  await upsertCoin(user.id, groupId, coin);
  const prices = await fetchPrices([coinId], apiKey);
  const price = prices.get(coinId) ?? null;
  const derived = calcPnl([], price);

  return c.html(<CoinRow coin={coin} derived={derived} groupId={groupId} />);
});

coins.delete("/groups/:groupId/coins/:coinId", async (c) => {
  const user = c.get("user");
  const { groupId, coinId } = c.req.param();
  await deleteCoin(user.id, groupId, coinId);
  return c.text("", 200);
});

coins.put("/groups/:groupId/coins/:coinId", async (c) => {
  const user = c.get("user");
  const { groupId, coinId } = c.req.param();
  const apiKey = user.coingeckoApiKey;
  if (!apiKey) return c.redirect("/settings?error=missing_key");

  const coin = await getCoin(user.id, groupId, coinId);
  if (!coin) {
    c.header("HX-Retarget", `#coin-meta-alert-${coinId}`);
    c.header("HX-Reswap", "innerHTML");
    return c.html(<span class="text-red-400 text-sm">Coin not found.</span>, 404);
  }

  const metadata = await fetchCoinMetadata([coinId], apiKey);
  const live = metadata.get(coinId);
  if (!live) {
    c.header("HX-Retarget", `#coin-meta-alert-${coinId}`);
    c.header("HX-Reswap", "innerHTML");
    return c.html(
      <span class="text-red-400 text-sm">Unable to fetch current CoinGecko metadata.</span>,
      400,
    );
  }

  await upsertCoin(user.id, groupId, { coinId, symbol: live.symbol, name: live.name });

  const updatedCoin = await getCoin(user.id, groupId, coinId);
  if (!updatedCoin) {
    return c.html(<span class="text-red-400 text-sm">Coin update failed.</span>, 500);
  }

  const prices = await fetchPrices([coinId], apiKey);
  const derived = calcPnl(updatedCoin.movements, prices.get(coinId) ?? null);

  return c.html(
    <>
      <div id={`coin-meta-alert-${coinId}`} hidden />
      <CoinRow coin={updatedCoin} derived={derived} groupId={groupId} hx-swap-oob="true" />
    </>,
  );
});

coins.get("/api/coins/search", async (c) => {
  const q = c.req.query("q") ?? "";
  if (!q.trim()) return c.html("", 200);

  const apiKey = c.get("user").coingeckoApiKey;
  if (!apiKey) {
    return c.html(
      <li class="px-3 py-3 text-red-400 text-sm text-center cursor-default">
        Configure your CoinGecko API key in Settings to search coins
      </li>,
    );
  }

  const results = await searchCoins(q, apiKey);
  if (results.length === 0) {
    return c.html(
      <li class="px-3 py-3 text-gray-500 text-sm text-center cursor-default">No results found</li>,
    );
  }

  return c.html(
    <ul>
      {results.map((r) => (
        <li
          key={r.id}
          data-coin-id={r.id}
          data-coin-symbol={r.symbol}
          data-coin-name={r.name}
          data-coin-display={`${r.name} (${r.symbol.toUpperCase()})`}
          class="px-3 py-2.5 hover:bg-gray-700 cursor-pointer text-sm flex items-center justify-between"
          hx-on:click={`
            var li = event.target.closest('li');
            document.getElementById('add-coin-id').value = li.dataset.coinId;
            document.getElementById('add-coin-symbol').value = li.dataset.coinSymbol;
            document.getElementById('add-coin-name').value = li.dataset.coinName;
            document.getElementById('coin-search').value = li.dataset.coinDisplay;
            document.getElementById('search-results').innerHTML = '';
          `}
        >
          <span>{r.name}</span>
          <span class="text-gray-400 text-xs">{r.symbol.toUpperCase()}</span>
        </li>
      ))}
    </ul>,
  );
});

export default coins;
