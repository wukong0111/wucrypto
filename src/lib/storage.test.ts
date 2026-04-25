import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { db } from "./db";
import { users } from "./db/schema";
import {
  addMovement,
  createGroup,
  deleteCoin,
  deleteGroup,
  deleteMovement,
  getCoin,
  getGroup,
  listCoins,
  listGroups,
  slugify,
  upsertCoin,
} from "./storage";
import type { CoinFile, Movement } from "./storage";
import { createTestUser, truncateAll } from "./test-helpers";

let userId: string;

beforeEach(async () => {
  await truncateAll();
  const user = await createTestUser();
  userId = user.id;
});

describe("slugify", () => {
  test("converts to lowercase kebab-case", () => {
    expect(slugify("Long Term")).toBe("long-term");
  });

  test("removes special characters", () => {
    expect(slugify("My @Portfolio! #1")).toBe("my-portfolio-1");
  });

  test("trims leading/trailing dashes", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  test("empty string returns empty", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("groups", () => {
  test("listGroups returns empty when no data", async () => {
    const groups = await listGroups(userId);
    expect(groups).toHaveLength(0);
  });

  test("createGroup persists and returns metadata", async () => {
    const group = await createGroup(userId, "Long Term");
    expect(group.id).toBe("long-term");
    expect(group.name).toBe("Long Term");
    expect(group.createdAt).toBeDefined();

    const groups = await listGroups(userId);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("long-term");
  });

  test("createGroup appends numeric suffix on slug collision", async () => {
    await createGroup(userId, "Long Term");
    const g2 = await createGroup(userId, "Long Term");
    expect(g2.id).toBe("long-term-1");
    const g3 = await createGroup(userId, "Long Term");
    expect(g3.id).toBe("long-term-2");
  });

  test("getGroup returns metadata", async () => {
    const created = await createGroup(userId, "My Group");
    const got = await getGroup(userId, created.id);
    expect(got).toEqual(created);
  });

  test("getGroup returns null for non-existent", async () => {
    const got = await getGroup(userId, "nope");
    expect(got).toBeNull();
  });

  test("deleteGroup removes from listing", async () => {
    const g = await createGroup(userId, "Delete Me");
    await deleteGroup(userId, g.id);
    const groups = await listGroups(userId);
    expect(groups).toHaveLength(0);
    const meta = await getGroup(userId, g.id);
    expect(meta).toBeNull();
  });

  test("deleteGroup is no-op for non-existent group", async () => {
    await deleteGroup(userId, "nope");
    const groups = await listGroups(userId);
    expect(groups).toHaveLength(0);
  });

  test("groups are scoped to user", async () => {
    await createGroup(userId, "My Group");
    const [other] = await db
      .insert(users)
      .values({ username: "other", passwordHash: "hash" })
      .returning();
    if (!other) throw new Error("Failed to create other user");
    const otherGroups = await listGroups(other.id);
    expect(otherGroups).toHaveLength(0);
  });
});

describe("coins", () => {
  let groupId: string;

  beforeEach(async () => {
    const g = await createGroup(userId, "Test Group");
    groupId = g.id;
  });

  test("listCoins returns empty array", async () => {
    const coins = await listCoins(userId, groupId);
    expect(coins).toHaveLength(0);
  });

  test("upsertCoin and getCoin roundtrip", async () => {
    const coin: Omit<CoinFile, "movements"> = {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
    };
    await upsertCoin(userId, groupId, coin);
    const got = await getCoin(userId, groupId, "bitcoin");
    expect(got?.coinId).toBe("bitcoin");
    expect(got?.symbol).toBe("BTC");
    expect(got?.name).toBe("Bitcoin");
    expect(got?.movements).toEqual([]);
  });

  test("listCoins returns all coins", async () => {
    await upsertCoin(userId, groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
    });
    await upsertCoin(userId, groupId, {
      coinId: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
    });
    const coins = await listCoins(userId, groupId);
    expect(coins).toHaveLength(2);
  });

  test("upsertCoin overwrites existing", async () => {
    await upsertCoin(userId, groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
    });
    await upsertCoin(userId, groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin Updated",
    });
    const coin = await getCoin(userId, groupId, "bitcoin");
    expect(coin?.name).toBe("Bitcoin Updated");
  });

  test("deleteCoin removes the coin", async () => {
    await upsertCoin(userId, groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
    });
    await deleteCoin(userId, groupId, "bitcoin");
    const coin = await getCoin(userId, groupId, "bitcoin");
    expect(coin).toBeNull();
  });
});

describe("movements", () => {
  let groupId: string;

  beforeEach(async () => {
    const g = await createGroup(userId, "Test Group");
    groupId = g.id;
    await upsertCoin(userId, groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
    });
  });

  const makeMovement = (type: "buy" | "sell", amount: number, price: number): Movement => ({
    id: crypto.randomUUID(),
    type,
    date: new Date().toISOString(),
    amount,
    pricePerCoin: price,
    note: "",
  });

  test("addMovement appends to coin", async () => {
    const m = makeMovement("buy", 0.5, 40000);
    const coin = await addMovement(userId, groupId, "bitcoin", m);
    expect(coin.movements).toHaveLength(1);
    expect(coin.movements[0]?.id).toBe(m.id);
  });

  test("addMovement creates coin if missing", async () => {
    const m = makeMovement("buy", 1, 30000);
    const coin = await addMovement(userId, groupId, "ethereum", m);
    expect(coin.coinId).toBe("ethereum");
    expect(coin.movements).toHaveLength(1);
  });

  test("deleteMovement removes specific movement", async () => {
    const m1 = makeMovement("buy", 0.5, 40000);
    const m2 = makeMovement("buy", 0.3, 45000);
    await addMovement(userId, groupId, "bitcoin", m1);
    await addMovement(userId, groupId, "bitcoin", m2);
    const coin = await deleteMovement(userId, groupId, "bitcoin", m1.id);
    expect(coin?.movements).toHaveLength(1);
    expect(coin?.movements[0]?.id).toBe(m2.id);
  });

  test("deleteMovement returns null for non-existent coin", async () => {
    const result = await deleteMovement(userId, groupId, "solana", "nope");
    expect(result).toBeNull();
  });
});
