import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  coins as coinsTable,
  groups as groupsTable,
  movements as movementsTable,
} from "./db/schema";

export type Movement = {
  id: string;
  type: "buy" | "sell";
  date: string;
  amount: number;
  pricePerCoin: number;
  note: string;
};

export type GroupMeta = {
  id: string;
  name: string;
  createdAt: string;
};

export type CoinFile = {
  coinId: string;
  symbol: string;
  name: string;
  movements: Movement[];
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function resolveGroupId(userId: string, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(and(eq(groupsTable.userId, userId), eq(groupsTable.slug, slug)))
    .limit(1);
  return row?.id ?? null;
}

export async function listGroups(userId: string): Promise<GroupMeta[]> {
  const rows = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.userId, userId))
    .orderBy(groupsTable.createdAt);
  return rows.map((r) => ({
    id: r.slug,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createGroup(userId: string, name: string): Promise<GroupMeta> {
  const base = slugify(name) || "group";
  const existing = await db
    .select({ slug: groupsTable.slug })
    .from(groupsTable)
    .where(and(eq(groupsTable.userId, userId), eq(groupsTable.slug, base)));

  let slug = base;
  if (existing.length > 0) {
    const allSlugs = await db
      .select({ slug: groupsTable.slug })
      .from(groupsTable)
      .where(eq(groupsTable.userId, userId));
    const slugSet = new Set(allSlugs.map((r) => r.slug));
    let suffix = 1;
    while (slugSet.has(`${base}-${suffix}`)) suffix++;
    slug = `${base}-${suffix}`;
  }

  const [row] = await db.insert(groupsTable).values({ userId, slug, name }).returning();
  if (!row) throw new Error("Failed to create group");
  return {
    id: row.slug,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deleteGroup(userId: string, groupSlug: string): Promise<void> {
  await db
    .delete(groupsTable)
    .where(and(eq(groupsTable.userId, userId), eq(groupsTable.slug, groupSlug)));
}

export async function getGroup(userId: string, groupSlug: string): Promise<GroupMeta | null> {
  const [row] = await db
    .select()
    .from(groupsTable)
    .where(and(eq(groupsTable.userId, userId), eq(groupsTable.slug, groupSlug)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.slug,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCoins(userId: string, groupSlug: string): Promise<CoinFile[]> {
  const groupId = await resolveGroupId(userId, groupSlug);
  if (!groupId) return [];

  const coinRows = await db.select().from(coinsTable).where(eq(coinsTable.groupId, groupId));

  const result: CoinFile[] = [];
  for (const coinRow of coinRows) {
    const movRows = await db
      .select()
      .from(movementsTable)
      .where(eq(movementsTable.coinId, coinRow.id))
      .orderBy(movementsTable.date);
    result.push({
      coinId: coinRow.coinId,
      symbol: coinRow.symbol,
      name: coinRow.name,
      movements: movRows.map((m) => ({
        id: m.id,
        type: m.type as "buy" | "sell",
        date: m.date.toISOString(),
        amount: m.amount,
        pricePerCoin: m.pricePerCoin,
        note: m.note,
      })),
    });
  }
  return result;
}

export async function getCoin(
  userId: string,
  groupSlug: string,
  coinId: string,
): Promise<CoinFile | null> {
  const groupId = await resolveGroupId(userId, groupSlug);
  if (!groupId) return null;

  const [coinRow] = await db
    .select()
    .from(coinsTable)
    .where(and(eq(coinsTable.groupId, groupId), eq(coinsTable.coinId, coinId)))
    .limit(1);
  if (!coinRow) return null;

  const movRows = await db
    .select()
    .from(movementsTable)
    .where(eq(movementsTable.coinId, coinRow.id))
    .orderBy(movementsTable.date);

  return {
    coinId: coinRow.coinId,
    symbol: coinRow.symbol,
    name: coinRow.name,
    movements: movRows.map((m) => ({
      id: m.id,
      type: m.type as "buy" | "sell",
      date: m.date.toISOString(),
      amount: m.amount,
      pricePerCoin: m.pricePerCoin,
      note: m.note,
    })),
  };
}

export async function upsertCoin(
  userId: string,
  groupSlug: string,
  coin: Omit<CoinFile, "movements">,
): Promise<void> {
  const groupId = await resolveGroupId(userId, groupSlug);
  if (!groupId) return;

  await db
    .insert(coinsTable)
    .values({ groupId, coinId: coin.coinId, symbol: coin.symbol, name: coin.name })
    .onConflictDoUpdate({
      target: [coinsTable.groupId, coinsTable.coinId],
      set: { symbol: coin.symbol, name: coin.name },
    });
}

export async function deleteCoin(userId: string, groupSlug: string, coinId: string): Promise<void> {
  const groupId = await resolveGroupId(userId, groupSlug);
  if (!groupId) return;

  await db
    .delete(coinsTable)
    .where(and(eq(coinsTable.groupId, groupId), eq(coinsTable.coinId, coinId)));
}

export async function addMovement(
  userId: string,
  groupSlug: string,
  coinId: string,
  movement: Movement,
): Promise<CoinFile> {
  const groupId = await resolveGroupId(userId, groupSlug);
  if (!groupId) {
    return { coinId, symbol: "", name: "", movements: [movement] };
  }

  const [coinRow] = await db
    .insert(coinsTable)
    .values({ groupId, coinId, symbol: "", name: "" })
    .onConflictDoNothing()
    .returning();

  const coinDbId = coinRow?.id;
  if (!coinDbId) {
    const [existing] = await db
      .select()
      .from(coinsTable)
      .where(and(eq(coinsTable.groupId, groupId), eq(coinsTable.coinId, coinId)))
      .limit(1);
    if (!existing) {
      return { coinId, symbol: "", name: "", movements: [movement] };
    }
    await db.insert(movementsTable).values({
      id: movement.id,
      coinId: existing.id,
      type: movement.type,
      date: new Date(movement.date),
      amount: movement.amount,
      pricePerCoin: movement.pricePerCoin,
      note: movement.note,
    });
    const movRows = await db
      .select()
      .from(movementsTable)
      .where(eq(movementsTable.coinId, existing.id))
      .orderBy(movementsTable.date);
    return {
      coinId: existing.coinId,
      symbol: existing.symbol,
      name: existing.name,
      movements: movRows.map((m) => ({
        id: m.id,
        type: m.type as "buy" | "sell",
        date: m.date.toISOString(),
        amount: m.amount,
        pricePerCoin: m.pricePerCoin,
        note: m.note,
      })),
    };
  }

  await db.insert(movementsTable).values({
    id: movement.id,
    coinId: coinDbId,
    type: movement.type,
    date: new Date(movement.date),
    amount: movement.amount,
    pricePerCoin: movement.pricePerCoin,
    note: movement.note,
  });

  return {
    coinId,
    symbol: "",
    name: "",
    movements: [movement],
  };
}

export async function deleteMovement(
  userId: string,
  groupSlug: string,
  coinId: string,
  movementId: string,
): Promise<CoinFile | null> {
  const coin = await getCoin(userId, groupSlug, coinId);
  if (!coin) return null;

  await db.delete(movementsTable).where(eq(movementsTable.id, movementId));

  const updated = await getCoin(userId, groupSlug, coinId);
  return updated;
}
