#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { coins, groups, movements, users } from "../src/lib/db/schema";

const DATA_DIR = Bun.env["DATA_DIR"] || "./data";

async function main() {
  const username = "admin";
  const password = "admin123";

  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(`User "${username}" already exists, using existing user.`);
  } else {
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({ username, passwordHash }).returning();
    if (!user) {
      console.error("Failed to create user");
      process.exit(1);
    }
    userId = user.id;
    console.log(`Created user "${username}" with password "${password}"`);
  }

  const indexPath = join(DATA_DIR, "groups.json");
  let groupIndex: { groups: Array<{ id: string; name: string; createdAt: string }> };
  try {
    groupIndex = await Bun.file(indexPath).json();
  } catch {
    console.log("No groups.json found, nothing to migrate.");
    return;
  }

  for (const groupMeta of groupIndex.groups) {
    const [existingGroup] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.userId, userId), eq(groups.slug, groupMeta.id)))
      .limit(1);

    let groupId: string;
    if (existingGroup) {
      groupId = existingGroup.id;
      console.log(`  Group "${groupMeta.name}" already exists, skipping.`);
    } else {
      const [group] = await db
        .insert(groups)
        .values({
          userId,
          slug: groupMeta.id,
          name: groupMeta.name,
          createdAt: new Date(groupMeta.createdAt),
        })
        .returning();
      if (!group) {
        console.error(`  Failed to create group "${groupMeta.name}"`);
        continue;
      }
      groupId = group.id;
      console.log(`  Created group "${groupMeta.name}"`);
    }

    const coinsDir = join(DATA_DIR, "groups", groupMeta.id, "coins");
    let coinFiles: string[];
    try {
      coinFiles = await readdir(coinsDir);
    } catch {
      console.log(`  No coins directory for group "${groupMeta.name}"`);
      continue;
    }

    for (const file of coinFiles) {
      if (!file.endsWith(".json")) continue;
      const coinData: {
        coinId: string;
        symbol: string;
        name: string;
        movements: Array<{
          id: string;
          type: "buy" | "sell";
          date: string;
          amount: number;
          pricePerCoin: number;
          note: string;
        }>;
      } = await Bun.file(join(coinsDir, file)).json();

      const [existingCoin] = await db
        .select()
        .from(coins)
        .where(and(eq(coins.groupId, groupId), eq(coins.coinId, coinData.coinId)))
        .limit(1);

      let coinDbId: string;
      if (existingCoin) {
        coinDbId = existingCoin.id;
        console.log(`    Coin "${coinData.name}" already exists, skipping coin row.`);
      } else {
        const [coin] = await db
          .insert(coins)
          .values({
            groupId,
            coinId: coinData.coinId,
            symbol: coinData.symbol,
            name: coinData.name,
          })
          .returning();
        if (!coin) {
          console.error(`    Failed to create coin "${coinData.name}"`);
          continue;
        }
        coinDbId = coin.id;
        console.log(`    Created coin "${coinData.name}" (${coinData.symbol})`);
      }

      if (coinData.movements.length > 0) {
        const existingMovs = await db
          .select({ id: movements.id })
          .from(movements)
          .where(eq(movements.coinId, coinDbId));
        const existingIds = new Set(existingMovs.map((m) => m.id));

        const newMovements = coinData.movements.filter((m) => !existingIds.has(m.id));
        if (newMovements.length > 0) {
          await db.insert(movements).values(
            newMovements.map((m) => ({
              id: m.id,
              coinId: coinDbId,
              type: m.type,
              date: new Date(m.date),
              amount: m.amount,
              pricePerCoin: m.pricePerCoin,
              note: m.note ?? "",
            })),
          );
          console.log(`      Inserted ${newMovements.length} movements`);
        }
      }
    }
  }

  console.log("\nMigration complete!");
  console.log(`Login: ${username} / ${password}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
