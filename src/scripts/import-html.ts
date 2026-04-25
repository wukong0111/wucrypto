#!/usr/bin/env bun
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";

// Usage:
//   bun run src/scripts/import-html.ts <input.html> --username <name> --group <slug>
//   bun run src/scripts/import-html.ts <input.html> --coin-id <uuid>
const args = Bun.argv.slice(2);
const inputPath = args[0];

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const username = getArg("--username");
const groupSlug = getArg("--group");
const coinUuid = getArg("--coin-id");

if (!inputPath || (!coinUuid && (!username || !groupSlug))) {
  console.error("Usage:");
  console.error(
    "  bun run src/scripts/import-html.ts <input.html> --username <name> --group <slug>",
  );
  console.error("  bun run src/scripts/import-html.ts <input.html> --coin-id <uuid>");
  process.exit(1);
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

type GeckoTx = {
  id: number;
  transaction_type: string;
  currency: string;
  quantity: string;
  price: string | null;
  transaction_timestamp: string;
  fees: string;
  cost: string;
  proceeds: string;
  notes: string;
};

const html = await Bun.file(inputPath).text();

const slugMatch = html.match(/data-coin-slug="([^"]+)"/);
if (!slugMatch) {
  console.error("Error: no data-coin-slug found in HTML");
  process.exit(1);
}
const coinSlug = slugMatch[1]!;

const txRe = /data-portfolio-coin-transaction-data="([^"]+)"/g;
const rawMovements: Array<{
  id: string;
  type: "buy" | "sell";
  date: string;
  amount: number;
  pricePerCoin: number;
  note: string;
}> = [];

for (const m of html.matchAll(txRe)) {
  const decoded = decodeHtmlEntities(m[1]!);
  const tx = JSON.parse(decoded) as GeckoTx;
  if (
    tx.transaction_type !== "buy" &&
    tx.transaction_type !== "sell" &&
    tx.transaction_type !== "transfer_out" &&
    tx.transaction_type !== "transfer_in"
  ) {
    console.error(`Skipping unknown type: ${tx.transaction_type}`);
    continue;
  }
  const type: "buy" | "sell" =
    tx.transaction_type === "transfer_out"
      ? "sell"
      : tx.transaction_type === "transfer_in"
        ? "buy"
        : (tx.transaction_type as "buy" | "sell");
  rawMovements.push({
    id: crypto.randomUUID(),
    type,
    date: tx.transaction_timestamp,
    amount: Number(tx.quantity),
    pricePerCoin: Number(tx.price ?? 0),
    note: tx.notes,
  });
}

if (rawMovements.length === 0) {
  console.log("No transactions found.");
  process.exit(0);
}

const dbUrl = Bun.env["DATABASE_URL"];
if (!dbUrl) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const client = postgres(dbUrl);
const db = drizzle(client, { schema });

// Resolve coin DB record
let coinDbId: string;

if (coinUuid) {
  const [found] = await db
    .select({ id: schema.coins.id })
    .from(schema.coins)
    .where(eq(schema.coins.id, coinUuid));
  if (!found) {
    console.error(`Coin not found with id: ${coinUuid}`);
    await client.end();
    process.exit(1);
  }
  coinDbId = found.id;
} else {
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username!));
  if (!user) {
    console.error(`User not found: ${username}`);
    await client.end();
    process.exit(1);
  }
  const [group] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(and(eq(schema.groups.userId, user.id), eq(schema.groups.slug, groupSlug!)));
  if (!group) {
    console.error(`Group not found: ${groupSlug} for user ${username}`);
    await client.end();
    process.exit(1);
  }
  const [coin] = await db
    .select({ id: schema.coins.id })
    .from(schema.coins)
    .where(and(eq(schema.coins.groupId, group.id), eq(schema.coins.coinId, coinSlug)));
  if (!coin) {
    console.error(`Coin not found: ${coinSlug} in group ${groupSlug}`);
    await client.end();
    process.exit(1);
  }
  coinDbId = coin.id;
}

// Deduplicate against existing movements in DB
const existing = await db
  .select({
    date: schema.movements.date,
    amount: schema.movements.amount,
    pricePerCoin: schema.movements.pricePerCoin,
  })
  .from(schema.movements)
  .where(eq(schema.movements.coinId, coinDbId));

const existingKeys = new Set(
  existing.map((m) => `${m.date.toISOString()}|${m.amount}|${m.pricePerCoin}`),
);

const toInsert = rawMovements.filter((m) => {
  const key = `${new Date(m.date).toISOString()}|${m.amount}|${m.pricePerCoin}`;
  return !existingKeys.has(key);
});

const skipped = rawMovements.length - toInsert.length;

if (toInsert.length > 0) {
  await db.insert(schema.movements).values(
    toInsert.map((m) => ({
      id: m.id,
      coinId: coinDbId,
      type: m.type,
      date: new Date(m.date),
      amount: m.amount,
      pricePerCoin: m.pricePerCoin,
      note: m.note,
    })),
  );
}

await client.end();
console.log(
  `Imported ${toInsert.length} movements (${skipped} duplicates skipped) → DB (${coinSlug})`,
);
