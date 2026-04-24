import type { FC } from "hono/jsx";
import type { CoinDerived, GroupSummary } from "../lib/calc";
import { fmtPct, fmtUsd, pnlColor, pnlTone } from "../lib/format";
import type { CoinFile, GroupMeta } from "../lib/storage";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { EmptyState } from "./components/EmptyState";
import { FormError } from "./components/FormError";
import { Icon } from "./components/Icon";
import { StatCard } from "./components/StatCard";

const STORAGE_KEY = "wucrypto-sort";
const NUMERIC_COLS = new Set(["holding", "value", "pnl", "pnlPct"]);
const DEFAULT_DIR: Record<string, "asc" | "desc"> = {
  name: "asc",
  ticker: "asc",
  holding: "desc",
  value: "desc",
  pnl: "desc",
  pnlPct: "desc",
};

const sortScript = `
(function() {
  var table = document.getElementById("coins-table");
  if (!table) return;
  var tbody = table.querySelector("tbody");
  var headers = table.querySelectorAll("th[data-sort]");
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem("${STORAGE_KEY}")); } catch(e) {}

  function applySort(col, dir) {
    var rows = Array.from(tbody.querySelectorAll("tr"));
    var headerIdx = -1;
    headers.forEach(function(h, i) { if (h.dataset.sort === col) headerIdx = i; });
    if (headerIdx < 0) return;

    var isNum = ${JSON.stringify([...NUMERIC_COLS])}.indexOf(col) >= 0;
    rows.sort(function(a, b) {
      var va = a.children[headerIdx].dataset.value;
      var vb = b.children[headerIdx].dataset.value;
      if (isNum) {
        var na = va === "" ? null : parseFloat(va);
        var nb = vb === "" ? null : parseFloat(vb);
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return dir === "asc" ? na - nb : nb - na;
      }
      if (va == null) va = "";
      if (vb == null) vb = "";
      var cmp = va.localeCompare(vb);
      return dir === "asc" ? cmp : -cmp;
    });
    rows.forEach(function(r) { tbody.appendChild(r); });
    updateIndicators(col, dir);
  }

  function updateIndicators(col, dir) {
    headers.forEach(function(h) {
      var icon = h.querySelector('.sort-icon');
      if (h.dataset.sort === col) {
        if (icon) icon.textContent = dir === "asc" ? " \\u25B2" : " \\u25BC";
        h.style.color = "#e5e7eb";
      } else {
        if (icon) icon.textContent = '';
        h.style.color = "";
      }
    });
  }

  headers.forEach(function(h) {
    h.addEventListener("click", function() {
      var col = h.dataset.sort;
      var prev = null;
      try { prev = JSON.parse(localStorage.getItem("${STORAGE_KEY}")); } catch(e) {}
      var dir = (prev && prev.col === col && prev.dir === "asc") ? "desc" : "asc";
      var dd = ${JSON.stringify(DEFAULT_DIR)};
      if (prev && prev.col !== col) dir = dd[col] || "asc";
      applySort(col, dir);
      localStorage.setItem("${STORAGE_KEY}", JSON.stringify({ col: col, dir: dir }));
    });
  });

  if (saved && saved.col) {
    applySort(saved.col, saved.dir || "asc");
  }
})();
`;

type GroupDetailViewProps = {
  group: GroupMeta;
  coins: CoinFile[];
  derived: Map<string, CoinDerived>;
  summary: GroupSummary;
  prices: Map<string, number | null>;
};

const GroupDetailView: FC<GroupDetailViewProps> = ({ group, coins, derived, summary }) => {
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

      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <form
          hx-post={`/groups/${group.id}/coins`}
          hx-target="#coins-table-body"
          hx-swap="beforeend"
          data-err="add-coin-error"
        >
          <div class="flex gap-2">
            <input type="hidden" name="coinId" id="add-coin-id" />
            <input type="hidden" name="symbol" id="add-coin-symbol" />
            <input type="hidden" name="name" id="add-coin-name" />
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
                class="absolute top-full left-0 w-full bg-gray-800 border border-gray-700 rounded-b-lg mt-0.5 z-10 max-h-48 overflow-auto"
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

      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static sort script, no user input */}
      <script dangerouslySetInnerHTML={{ __html: sortScript }} />
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
