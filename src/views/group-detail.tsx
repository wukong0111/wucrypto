import type { FC } from "hono/jsx";
import type { CoinDerived, GroupSummary } from "../lib/calc";
import type { CoinFile, GroupMeta } from "../lib/storage";

type GroupDetailViewProps = {
  group: GroupMeta;
  coins: CoinFile[];
  derived: Map<string, CoinDerived>;
  summary: GroupSummary;
  prices: Map<string, number | null>;
};

function fmtUsd(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pnlColor(value: number | null): string {
  if (value === null) return "";
  return value >= 0 ? "text-pnl-positive" : "text-pnl-negative";
}

const GroupDetailView: FC<GroupDetailViewProps> = ({ group, coins, derived, summary }) => (
  <>
    <div class="mb-4">
      <a href="/" class="text-blue-400 hover:underline text-sm">
        &larr; Back
      </a>
    </div>

    <h1 class="text-2xl font-bold mb-2">{group.name}</h1>

    <div class="flex gap-6 mb-6 text-sm">
      <div>
        <span class="text-gray-400">Total Value: </span>
        <span class="font-semibold">{fmtUsd(summary.totalValueUsd)}</span>
      </div>
      <div>
        <span class="text-gray-400">Total P&L: </span>
        <span class={`font-semibold ${pnlColor(summary.totalPnl)}`}>
          {fmtUsd(summary.totalPnl)} (
          {fmtPct(
            summary.totalValueUsd > 0
              ? (summary.totalPnl / (summary.totalValueUsd - summary.totalPnl)) * 100
              : null,
          )}
          )
        </span>
      </div>
    </div>

    <form
      hx-post={`/groups/${group.id}/coins`}
      hx-target="#coins-table-body"
      hx-swap="beforeend"
      class="mb-6"
    >
      <div class="flex gap-2">
        <input type="hidden" name="coinId" id="add-coin-id" />
        <input type="hidden" name="symbol" id="add-coin-symbol" />
        <input type="hidden" name="name" id="add-coin-name" />
        <div class="relative flex-1">
          <input
            type="text"
            name="q"
            id="coin-search"
            placeholder="Search coin..."
            autocomplete="off"
            hx-get="/api/coins/search"
            hx-trigger="keyup changed delay:300ms"
            hx-target="#search-results"
            class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <ul
            id="search-results"
            class="absolute top-full left-0 w-full bg-gray-800 border border-gray-700 rounded-b mt-0.5 z-10 max-h-48 overflow-auto"
          />
        </div>
        <button
          type="submit"
          class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
        >
          Add
        </button>
      </div>
    </form>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-gray-400 border-b border-gray-800">
          <th class="text-left py-2">Name</th>
          <th class="text-left py-2">Ticker</th>
          <th class="text-right py-2">Holding</th>
          <th class="text-right py-2">Value (USD)</th>
          <th class="text-right py-2">P&L</th>
          <th class="text-right py-2">P&L %</th>
          <th class="text-right py-2" />
        </tr>
      </thead>
      <tbody id="coins-table-body">
        {coins.map((coin) => {
          const d = derived.get(coin.coinId);
          return <CoinRow key={coin.coinId} coin={coin} derived={d} groupId={group.id} />;
        })}
      </tbody>
    </table>

    {coins.length === 0 && (
      <p class="text-gray-500 text-sm mt-4">No coins in this group. Add one above.</p>
    )}
  </>
);

export default GroupDetailView;

type CoinRowProps = {
  coin: CoinFile;
  derived: CoinDerived | undefined;
  groupId: string;
};

export const CoinRow: FC<CoinRowProps> = ({ coin, derived, groupId }) => {
  const d = derived ?? { holding: 0, costBasis: 0, currentValueUsd: null, pnl: null, pnlPct: null };
  return (
    <tr id={`coin-${coin.coinId}`} class="border-b border-gray-800/50 hover:bg-gray-900">
      <td class="py-2">
        <a href={`/groups/${groupId}/coins/${coin.coinId}`} class="text-blue-400 hover:underline">
          {coin.name}
        </a>
      </td>
      <td class="py-2 text-gray-400">{coin.symbol.toUpperCase()}</td>
      <td class="py-2 text-right">
        {d.holding.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0")}
      </td>
      <td class="py-2 text-right">{fmtUsd(d.currentValueUsd)}</td>
      <td class={`py-2 text-right ${pnlColor(d.pnl)}`}>{fmtUsd(d.pnl)}</td>
      <td class={`py-2 text-right ${pnlColor(d.pnl)}`}>{fmtPct(d.pnlPct)}</td>
      <td class="py-2 text-right">
        <button
          type="button"
          hx-delete={`/groups/${groupId}/coins/${coin.coinId}`}
          hx-target={`#coin-${coin.coinId}`}
          hx-swap="outerHTML"
          hx-confirm={`Remove ${coin.name} from this group?`}
          class="text-gray-500 hover:text-red-400"
        >
          &times;
        </button>
      </td>
    </tr>
  );
};
