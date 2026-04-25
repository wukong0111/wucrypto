import { Hono } from "hono";
import { calcGroupSummary, calcPnl } from "../lib/calc";
import { fetchPrices, searchCoins } from "../lib/coingecko";
import { deleteCoin, getGroup, listCoins, upsertCoin } from "../lib/storage";
import GroupDetailView, { CoinRow } from "../views/group-detail";
import Layout from "../views/layout";

const coins = new Hono<{
  Variables: { user: { id: string; username: string } };
}>();

coins.get("/groups/:groupId", async (c) => {
  const user = c.get("user");
  const { groupId } = c.req.param();
  const group = await getGroup(user.id, groupId);
  if (!group) return c.text("Group not found", 404);

  const coinList = await listCoins(user.id, groupId);
  const coinIds = coinList.map((coin) => coin.coinId);
  const prices = await fetchPrices(coinIds);

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

  const summary = calcGroupSummary(summaryInput);

  return c.html(
    <Layout title={group.name} username={user.username}>
      <GroupDetailView
        group={group}
        coins={coinList}
        derived={derived}
        summary={summary}
        prices={prices}
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

  const coin = { coinId, symbol, name, movements: [] };
  await upsertCoin(user.id, groupId, coin);
  const prices = await fetchPrices([coinId]);
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

coins.get("/api/coins/search", async (c) => {
  const q = c.req.query("q") ?? "";
  if (!q.trim()) return c.html("", 200);

  const results = await searchCoins(q);
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
