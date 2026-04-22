import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

let testDir: string;
const origDataDir = Bun.env["DATA_DIR"];

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "wucrypto-test-"));
  Bun.env["DATA_DIR"] = testDir;
});

afterEach(async () => {
  Bun.env["DATA_DIR"] = origDataDir;
  await rm(testDir, { recursive: true, force: true });
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
    const index = await listGroups();
    expect(index.groups).toHaveLength(0);
  });

  test("createGroup persists and returns metadata", async () => {
    const group = await createGroup("Long Term");
    expect(group.id).toBe("long-term");
    expect(group.name).toBe("Long Term");
    expect(group.createdAt).toBeDefined();

    const index = await listGroups();
    expect(index.groups).toHaveLength(1);
    expect(index.groups[0]?.id).toBe("long-term");
  });

  test("createGroup appends numeric suffix on slug collision", async () => {
    await createGroup("Long Term");
    const g2 = await createGroup("Long Term");
    expect(g2.id).toBe("long-term-1");
    const g3 = await createGroup("Long Term");
    expect(g3.id).toBe("long-term-2");
  });

  test("getGroup returns metadata", async () => {
    const created = await createGroup("My Group");
    const got = await getGroup(created.id);
    expect(got).toEqual(created);
  });

  test("getGroup returns null for non-existent", async () => {
    const got = await getGroup("nope");
    expect(got).toBeNull();
  });

  test("deleteGroup removes from index and filesystem", async () => {
    const g = await createGroup("Delete Me");
    await deleteGroup(g.id);
    const index = await listGroups();
    expect(index.groups).toHaveLength(0);
    const meta = await getGroup(g.id);
    expect(meta).toBeNull();
  });

  test("deleteGroup is no-op for non-existent group", async () => {
    await deleteGroup("nope");
    const index = await listGroups();
    expect(index.groups).toHaveLength(0);
  });
});

describe("coins", () => {
  let groupId: string;

  beforeEach(async () => {
    const g = await createGroup("Test Group");
    groupId = g.id;
  });

  test("listCoins returns empty array", async () => {
    const coins = await listCoins(groupId);
    expect(coins).toHaveLength(0);
  });

  test("upsertCoin and getCoin roundtrip", async () => {
    const coin: CoinFile = {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      movements: [],
    };
    await upsertCoin(groupId, coin);
    const got = await getCoin(groupId, "bitcoin");
    expect(got).toEqual(coin);
  });

  test("listCoins returns all coins", async () => {
    await upsertCoin(groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      movements: [],
    });
    await upsertCoin(groupId, {
      coinId: "ethereum",
      symbol: "ETH",
      name: "Ethereum",
      movements: [],
    });
    const coins = await listCoins(groupId);
    expect(coins).toHaveLength(2);
  });

  test("upsertCoin overwrites existing", async () => {
    await upsertCoin(groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      movements: [],
    });
    await upsertCoin(groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      movements: [
        { id: "1", type: "buy", date: "2026-01-01", amount: 1, pricePerCoin: 50000, note: "" },
      ],
    });
    const coin = await getCoin(groupId, "bitcoin");
    expect(coin?.movements).toHaveLength(1);
  });

  test("deleteCoin removes the file", async () => {
    await upsertCoin(groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      movements: [],
    });
    await deleteCoin(groupId, "bitcoin");
    const coin = await getCoin(groupId, "bitcoin");
    expect(coin).toBeNull();
  });
});

describe("movements", () => {
  let groupId: string;

  beforeEach(async () => {
    const g = await createGroup("Test Group");
    groupId = g.id;
    await upsertCoin(groupId, {
      coinId: "bitcoin",
      symbol: "BTC",
      name: "Bitcoin",
      movements: [],
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
    const coin = await addMovement(groupId, "bitcoin", m);
    expect(coin.movements).toHaveLength(1);
    expect(coin.movements[0]?.id).toBe(m.id);
  });

  test("addMovement creates coin if missing", async () => {
    const m = makeMovement("buy", 1, 30000);
    const coin = await addMovement(groupId, "ethereum", m);
    expect(coin.coinId).toBe("ethereum");
    expect(coin.movements).toHaveLength(1);
  });

  test("deleteMovement removes specific movement", async () => {
    const m1 = makeMovement("buy", 0.5, 40000);
    const m2 = makeMovement("buy", 0.3, 45000);
    await addMovement(groupId, "bitcoin", m1);
    await addMovement(groupId, "bitcoin", m2);
    const coin = await deleteMovement(groupId, "bitcoin", m1.id);
    expect(coin?.movements).toHaveLength(1);
    expect(coin?.movements[0]?.id).toBe(m2.id);
  });

  test("deleteMovement returns null for non-existent coin", async () => {
    const result = await deleteMovement(groupId, "solana", "nope");
    expect(result).toBeNull();
  });
});

describe("concurrency", () => {
  test("concurrent writes are serialized", async () => {
    const g = await createGroup("Concurrent");
    const writes = Array.from({ length: 10 }, (_, i) =>
      addMovement(g.id, "bitcoin", {
        id: `mov-${i}`,
        type: "buy",
        date: new Date().toISOString(),
        amount: i + 1,
        pricePerCoin: 1000,
        note: "",
      }),
    );
    await Promise.all(writes);
    const coin = await getCoin(g.id, "bitcoin");
    expect(coin?.movements).toHaveLength(10);
  });
});
