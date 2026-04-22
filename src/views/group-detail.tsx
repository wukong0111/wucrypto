import type { FC } from "hono/jsx";
import type { CoinDerived, GroupSummary } from "../lib/calc";
import type { CoinFile, GroupMeta } from "../lib/storage";

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
      if (h.dataset.sort === col) {
        h.textContent = h.textContent.replace(/ [\\u25B2\\u25BC]$/, "");
        h.textContent += dir === "asc" ? " \\u25B2" : " \\u25BC";
        h.style.color = "#e5e7eb";
      } else {
        h.textContent = h.textContent.replace(/ [\\u25B2\\u25BC]$/, "");
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

    <table class="w-full text-sm" id="coins-table">
      <thead>
        <tr class="text-gray-400 border-b border-gray-800">
          <th
            data-sort="name"
            class="text-left py-2 cursor-pointer select-none hover:text-gray-200"
          >
            Name
          </th>
          <th
            data-sort="ticker"
            class="text-left py-2 cursor-pointer select-none hover:text-gray-200"
          >
            Ticker
          </th>
          <th
            data-sort="holding"
            class="text-right py-2 cursor-pointer select-none hover:text-gray-200"
          >
            Holding
          </th>
          <th
            data-sort="value"
            class="text-right py-2 cursor-pointer select-none hover:text-gray-200"
          >
            Value (USD)
          </th>
          <th
            data-sort="pnl"
            class="text-right py-2 cursor-pointer select-none hover:text-gray-200"
          >
            P&L
          </th>
          <th
            data-sort="pnlPct"
            class="text-right py-2 cursor-pointer select-none hover:text-gray-200"
          >
            P&L %
          </th>
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

    {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static sort script, no user input */}
    <script dangerouslySetInnerHTML={{ __html: sortScript }} />
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
      <td class="py-2" data-value={coin.name}>
        <a href={`/groups/${groupId}/coins/${coin.coinId}`} class="text-blue-400 hover:underline">
          {coin.name}
        </a>
      </td>
      <td class="py-2 text-gray-400" data-value={coin.symbol}>
        {coin.symbol.toUpperCase()}
      </td>
      <td class="py-2 text-right" data-value={d.holding}>
        {d.holding.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0")}
      </td>
      <td class="py-2 text-right" data-value={d.currentValueUsd ?? ""}>
        {fmtUsd(d.currentValueUsd)}
      </td>
      <td class={`py-2 text-right ${pnlColor(d.pnl)}`} data-value={d.pnl ?? ""}>
        {fmtUsd(d.pnl)}
      </td>
      <td class={`py-2 text-right ${pnlColor(d.pnl)}`} data-value={d.pnlPct ?? ""}>
        {fmtPct(d.pnlPct)}
      </td>
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
