import type { FC } from "hono/jsx";
import type { CoinDerived, GroupSummary } from "../lib/calc";
import { fmtPct, fmtUsd, pnlColor, pnlTone } from "../lib/format";
import type { CoinFile, GroupMeta } from "../lib/storage";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { EmptyState } from "./components/EmptyState";
import { FormError } from "./components/FormError";
import { Icon } from "./components/Icon";
import { StatCard } from "./components/StatCard";

type CoinMetadataDiscrepancy = {
  coinId: string;
  symbol: string;
  name: string;
  liveSymbol: string;
  liveName: string;
};

type GroupDetailViewProps = {
  group: GroupMeta;
  coins: CoinFile[];
  derived: Map<string, CoinDerived>;
  summary: GroupSummary;
  prices: Map<string, number | null>;
  discrepancies?: CoinMetadataDiscrepancy[];
};

const GroupDetailView: FC<GroupDetailViewProps> = ({
  group,
  coins,
  derived,
  summary,
  discrepancies = [],
}) => {
  const pnlPct =
    summary.totalValueUsd > 0
      ? (summary.totalPnl / (summary.totalValueUsd - summary.totalPnl)) * 100
      : null;

  return (
    <>
      <Breadcrumbs items={[{ label: "Groups", href: "/" }, { label: group.name }]} />

      <h1 class="text-2xl font-bold mb-6">{group.name}</h1>

      <div class="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Value" value={fmtUsd(summary.totalValueUsd)} />
        <StatCard
          label="Total P&L"
          value={fmtUsd(summary.totalPnl)}
          sublabel={pnlPct !== null ? fmtPct(pnlPct) : undefined}
          tone={summary.totalPnl > 0 ? "positive" : summary.totalPnl < 0 ? "negative" : "neutral"}
        />
        <StatCard label="Coins" value={String(coins.length)} />
      </div>

      {discrepancies.length > 0 && (
        <div class="mb-6 space-y-2">
          {discrepancies.map((d) => (
            <div
              key={d.coinId}
              id={`coin-meta-alert-${d.coinId}`}
              class="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 flex items-center justify-between"
            >
              <p class="text-sm text-yellow-200">
                <span class="font-medium">
                  {d.name} ({d.symbol.toUpperCase()})
                </span>{" "}
                is now listed as{" "}
                <span class="font-medium">
                  {d.liveName} ({d.liveSymbol.toUpperCase()})
                </span>{" "}
                on CoinGecko.
              </p>
              <div class="flex items-center gap-2 ml-4">
                <button
                  type="button"
                  hx-put={`/groups/${group.id}/coins/${d.coinId}`}
                  hx-target={`#coin-meta-alert-${d.coinId}`}
                  hx-swap="outerHTML"
                  class="bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
                >
                  Update
                </button>
                <button
                  type="button"
                  hx-on:click={`document.getElementById('coin-meta-alert-${d.coinId}').remove()`}
                  class="text-yellow-400 hover:text-yellow-300 text-xs px-2 py-1.5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <form
          hx-post={`/groups/${group.id}/coins`}
          hx-target="#coins-table-body"
          hx-swap="beforeend"
          data-err="add-coin-error"
        >
          <div class="flex gap-2">
            <input type="hidden" name="coinId" id="add-coin-id" autocomplete="off" />
            <input type="hidden" name="symbol" id="add-coin-symbol" autocomplete="off" />
            <input type="hidden" name="name" id="add-coin-name" autocomplete="off" />
            <div class="relative flex-1">
              <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <Icon name="search" class="w-4 h-4" />
              </div>
              <input
                type="text"
                name="q"
                id="coin-search"
                placeholder="Search coin..."
                autocomplete="off"
                hx-get="/api/coins/search"
                hx-trigger="keyup changed delay:300ms"
                hx-target="#search-results"
                hx-indicator="#search-spinner"
                class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <div
                id="search-spinner"
                class="htmx-indicator absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                <Icon name="loader-2" class="w-4 h-4 animate-spin text-gray-400" />
              </div>
              <ul
                id="search-results"
                class="absolute top-full left-0 w-full bg-gray-800 border border-gray-700 rounded-b-lg mt-0.5 z-10 max-h-48 overflow-auto empty:hidden"
              />
            </div>
            <button
              type="submit"
              class="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Icon name="plus" class="w-4 h-4" />
              Add
            </button>
          </div>
        </form>
        <FormError id="add-coin-error" />
      </div>

      <table class="w-full text-sm" id="coins-table">
        <thead>
          <tr class="text-gray-500 border-b border-gray-800">
            <th
              data-sort="name"
              class="text-left py-3 pr-4 uppercase tracking-wide text-xs cursor-pointer select-none hover:text-gray-300"
            >
              Name
              <span class="sort-icon" />
            </th>
            <th
              data-sort="ticker"
              class="text-left py-3 pr-4 uppercase tracking-wide text-xs cursor-pointer select-none hover:text-gray-300"
            >
              Ticker
              <span class="sort-icon" />
            </th>
            <th
              data-sort="holding"
              class="text-right py-3 pr-4 uppercase tracking-wide text-xs cursor-pointer select-none hover:text-gray-300"
            >
              Holding
              <span class="sort-icon" />
            </th>
            <th
              data-sort="value"
              class="text-right py-3 pr-4 uppercase tracking-wide text-xs cursor-pointer select-none hover:text-gray-300"
            >
              Value (USD)
              <span class="sort-icon" />
            </th>
            <th
              data-sort="pnl"
              class="text-right py-3 pr-4 uppercase tracking-wide text-xs cursor-pointer select-none hover:text-gray-300"
            >
              P&L
              <span class="sort-icon" />
            </th>
            <th
              data-sort="pnlPct"
              class="text-right py-3 uppercase tracking-wide text-xs cursor-pointer select-none hover:text-gray-300"
            >
              P&L %<span class="sort-icon" />
            </th>
            <th class="text-right py-3 w-10" />
          </tr>
        </thead>
        <tbody id="coins-table-body" class="divide-y divide-gray-800/50">
          {coins.map((coin) => {
            const d = derived.get(coin.coinId);
            return <CoinRow key={coin.coinId} coin={coin} derived={d} groupId={group.id} />;
          })}
        </tbody>
      </table>

      {coins.length === 0 && (
        <EmptyState
          icon="circle-dollar-sign"
          title="No coins in this group"
          hint="Search for a coin above and click Add."
        />
      )}

      <script src="/sort-coins.js" />
    </>
  );
};

export default GroupDetailView;

type CoinRowProps = {
  coin: CoinFile;
  derived: CoinDerived | undefined;
  groupId: string;
};

export const CoinRow: FC<CoinRowProps> = ({ coin, derived, groupId }) => {
  const d = derived ?? {
    holding: 0,
    costBasis: 0,
    currentValueUsd: null,
    pnl: null,
    pnlPct: null,
  };
  return (
    <tr id={`coin-${coin.coinId}`} class="hover:bg-gray-900/50">
      <td class="py-3 pr-4" data-value={coin.name}>
        <a
          href={`/groups/${groupId}/coins/${coin.coinId}`}
          class="text-blue-400 hover:text-blue-300 transition-colors"
        >
          {coin.name}
        </a>
      </td>
      <td class="py-3 pr-4 text-gray-400" data-value={coin.symbol}>
        {coin.symbol.toUpperCase()}
      </td>
      <td class="py-3 pr-4 text-right" data-value={d.holding}>
        {d.holding.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0")}
      </td>
      <td class="py-3 pr-4 text-right" data-value={d.currentValueUsd ?? ""}>
        {fmtUsd(d.currentValueUsd)}
      </td>
      <td class={`py-3 pr-4 text-right ${pnlColor(d.pnl)}`} data-value={d.pnl ?? ""}>
        {fmtUsd(d.pnl)}
      </td>
      <td class={`py-3 text-right ${pnlColor(d.pnl)}`} data-value={d.pnlPct ?? ""}>
        {fmtPct(d.pnlPct)}
      </td>
      <td class="py-3 text-right w-10">
        <button
          type="button"
          hx-delete={`/groups/${groupId}/coins/${coin.coinId}`}
          hx-target={`#coin-${coin.coinId}`}
          hx-swap="outerHTML"
          data-confirm-delete
          title="Delete coin"
          class="text-gray-600 hover:text-red-400 transition-colors p-1 rounded"
        >
          <Icon name="trash-2" class="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
