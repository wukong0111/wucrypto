#!/usr/bin/env bun
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const sourceUrl = Bun.env["DATABASE_URL"]!;
const targetUrl = Bun.env["RAILWAY_DATABASE_URL"]!;

if (!sourceUrl || !targetUrl) {
  console.error("DATABASE_URL and RAILWAY_DATABASE_URL must be set");
  process.exit(1);
}

const srcClient = postgres(sourceUrl);
const tgtClient = postgres(targetUrl);
const src = drizzle(srcClient, { schema });
const tgt = drizzle(tgtClient, { schema });

async function main() {
  const srcUsers = await src.select().from(schema.users);
  console.log(`Users: ${srcUsers.length}`);
  if (srcUsers.length > 0) {
    await tgt.insert(schema.users).values(srcUsers).onConflictDoNothing();
  }

  const srcGroups = await src.select().from(schema.groups);
  console.log(`Groups: ${srcGroups.length}`);
  if (srcGroups.length > 0) {
    await tgt.insert(schema.groups).values(srcGroups).onConflictDoNothing();
  }

  const srcCoins = await src.select().from(schema.coins);
  console.log(`Coins: ${srcCoins.length}`);
  if (srcCoins.length > 0) {
    await tgt.insert(schema.coins).values(srcCoins).onConflictDoNothing();
  }

  const srcMovements = await src.select().from(schema.movements);
  console.log(`Movements: ${srcMovements.length}`);
  if (srcMovements.length > 0) {
    await tgt.insert(schema.movements).values(srcMovements).onConflictDoNothing();
  }

  console.log("Migration complete!");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await srcClient.end();
    await tgtClient.end();
  });
