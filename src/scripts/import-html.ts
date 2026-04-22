import { rename } from "node:fs/promises";
import { join } from "node:path";
import type { CoinFile, Movement } from "../lib/storage";

const [inputPath, outputPath] = Bun.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: bun run src/scripts/import-html.ts <input-html> <output-json>");
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

function toMovement(tx: GeckoTx): Movement {
  const type: "buy" | "sell" =
    tx.transaction_type === "transfer_out"
      ? "sell"
      : tx.transaction_type === "transfer_in"
        ? "buy"
        : (tx.transaction_type as "buy" | "sell");
  return {
    id: crypto.randomUUID(),
    type,
    date: tx.transaction_timestamp,
    amount: Number(tx.quantity),
    pricePerCoin: Number(tx.price ?? 0),
    note: tx.notes,
  };
}

const html = await Bun.file(inputPath).text();

const slugMatch = html.match(/data-coin-slug="([^"]+)"/);
if (!slugMatch) {
  console.error("Error: no data-coin-slug found in HTML");
  process.exit(1);
}
const coinId = slugMatch[1];

const txRe = /data-portfolio-coin-transaction-data="([^"]+)"/g;
const transactions: GeckoTx[] = [];
for (const m of html.matchAll(txRe)) {
  const decoded = decodeHtmlEntities(m[1]);
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
  transactions.push(tx);
}

if (transactions.length === 0) {
  console.log("No transactions found.");
  process.exit(0);
}

const coinFile = await Bun.file(outputPath)
  .json<CoinFile>()
  .catch(() => null);
if (!coinFile) {
  console.error(`Error: output file not found: ${outputPath}`);
  process.exit(1);
}

const existingKeys = new Set(
  coinFile.movements.map((m) => `${m.date}|${m.amount}|${m.pricePerCoin}`),
);

let skipped = 0;
for (const tx of transactions) {
  const m = toMovement(tx);
  const key = `${m.date}|${m.amount}|${m.pricePerCoin}`;
  if (existingKeys.has(key)) {
    skipped++;
    continue;
  }
  coinFile.movements.push(m);
  existingKeys.add(key);
}

await Bun.write(`${outputPath}.tmp`, `${JSON.stringify(coinFile, null, 2)}\n`);
await rename(`${outputPath}.tmp`, outputPath);

console.log(
  `Imported ${transactions.length - skipped} movements (${skipped} duplicates skipped) → ${outputPath}`,
);
