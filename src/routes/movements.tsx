import { Hono } from "hono";
import { calcPnl } from "../lib/calc";
import { fetchPrices } from "../lib/coingecko";
import { addMovement, deleteMovement, getCoin, getGroup } from "../lib/storage";
import CoinDetailView, { MovementRow } from "../views/coin-detail";
import Layout from "../views/layout";

const movements = new Hono();

movements.get("/groups/:groupId/coins/:coinId", async (c) => {
  const { groupId, coinId } = c.req.param();
  const group = await getGroup(groupId);
  if (!group) return c.text("Group not found", 404);

  const coin = await getCoin(groupId, coinId);
  if (!coin) return c.text("Coin not found", 404);

  const prices = await fetchPrices([coinId]);
  const price = prices.get(coinId) ?? null;
  const derived = calcPnl(coin.movements, price);

  return c.html(
    <Layout title={`${coin.name} — ${group.name}`}>
      <CoinDetailView coin={coin} derived={derived} groupId={groupId} />
    </Layout>,
  );
});

movements.post("/groups/:groupId/coins/:coinId/movements", async (c) => {
  const { groupId, coinId } = c.req.param();
  const body = await c.req.parseBody();
  const type = String(body["type"] ?? "buy") as "buy" | "sell";
  const date = String(body["date"] ?? "").trim();
  const amount = Number.parseFloat(String(body["amount"] ?? ""));
  const pricePerCoin = Number.parseFloat(String(body["pricePerCoin"] ?? ""));
  const note = String(body["note"] ?? "").trim();

  if (
    !date ||
    Number.isNaN(amount) ||
    Number.isNaN(pricePerCoin) ||
    amount <= 0 ||
    pricePerCoin <= 0
  ) {
    return c.html(<span class="text-red-400 text-sm">Invalid movement data</span>, 400);
  }

  const movement = {
    id: crypto.randomUUID(),
    type,
    date: new Date(date).toISOString(),
    amount,
    pricePerCoin,
    note,
  };

  await addMovement(groupId, coinId, movement);
  return c.html(<MovementRow movement={movement} groupId={groupId} coinId={coinId} />);
});

movements.delete("/groups/:groupId/coins/:coinId/movements/:movId", async (c) => {
  const { groupId, coinId, movId } = c.req.param();
  await deleteMovement(groupId, coinId, movId);
  return c.text("", 200);
});

export default movements;
