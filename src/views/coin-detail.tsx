import type { FC } from "hono/jsx";
import type { CoinDerived } from "../lib/calc";
import { fmtPct, fmtUsd, pnlColor, pnlTone } from "../lib/format";
import type { CoinFile } from "../lib/storage";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { EmptyState } from "./components/EmptyState";
import { FormError } from "./components/FormError";
import { Icon } from "./components/Icon";
import { StatCard } from "./components/StatCard";

type CoinDetailViewProps = {
  coin: CoinFile;
  derived: CoinDerived;
  groupId: string;
  groupName: string;
};

const CoinDetailView: FC<CoinDetailViewProps> = ({ coin, derived, groupId, groupName }) => (
  <>
    <Breadcrumbs
      items={[
        { label: "Groups", href: "/" },
        { label: groupName, href: `/groups/${groupId}` },
        { label: coin.name },
      ]}
    />

    <div id="coin-header" class="mb-8">
      <h1 class="text-2xl font-bold mb-6">
        {coin.name}{" "}
        <span class="text-gray-500 text-lg font-normal">{coin.symbol.toUpperCase()}</span>
      </h1>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          label="Holding"
          value={derived.holding.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0")}
        />
        <StatCard
          label="Avg Price"
          value={fmtUsd(derived.holding > 0 ? derived.costBasis / derived.holding : null)}
        />
        <StatCard label="Value" value={fmtUsd(derived.currentValueUsd)} />
        <StatCard label="P&L" value={fmtUsd(derived.pnl)} tone={pnlTone(derived.pnl)} />
        <StatCard label="P&L %" value={fmtPct(derived.pnlPct)} tone={pnlTone(derived.pnl)} />
      </div>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
      <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Add Movement</h2>
      <form
        hx-post={`/groups/${groupId}/coins/${coin.coinId}/movements`}
        hx-target="#movements-body"
        hx-swap="afterbegin"
        data-err="add-movement-error"
        class="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end"
      >
        <div>
          <label class="block text-xs text-gray-500 mb-1 uppercase tracking-wide" for="mov-type">
            Type
          </label>
          <select
            id="mov-type"
            name="type"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1 uppercase tracking-wide" for="mov-date">
            Date
          </label>
          <input
            id="mov-date"
            type="datetime-local"
            name="date"
            value={new Date().toISOString().slice(0, 16)}
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1 uppercase tracking-wide" for="mov-amount">
            Amount
          </label>
          <input
            id="mov-amount"
            type="number"
            step="any"
            name="amount"
            required
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1 uppercase tracking-wide" for="mov-price">
            Price/Coin (USD)
          </label>
          <input
            id="mov-price"
            type="number"
            step="any"
            name="pricePerCoin"
            required
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1 uppercase tracking-wide" for="mov-note">
            Note
          </label>
          <input
            id="mov-note"
            type="text"
            name="note"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          class="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Icon name="plus" class="w-4 h-4" />
          Add
        </button>
      </form>
      <FormError id="add-movement-error" />
    </div>

    <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Movements</h2>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-gray-500 border-b border-gray-800 uppercase tracking-wide text-xs">
          <th class="text-left py-3 pr-4">Date</th>
          <th class="text-left py-3 pr-4">Type</th>
          <th class="text-right py-3 pr-4">Amount</th>
          <th class="text-right py-3 pr-4">Price/Coin</th>
          <th class="text-right py-3 pr-4">Total</th>
          <th class="text-left py-3 pr-4">Note</th>
          <th class="text-right py-3 w-10" />
        </tr>
      </thead>
      <tbody id="movements-body" class="divide-y divide-gray-800/50">
        {[...coin.movements]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((m) => (
            <MovementRow key={m.id} movement={m} groupId={groupId} coinId={coin.coinId} />
          ))}
      </tbody>
    </table>

    {coin.movements.length === 0 && (
      <EmptyState icon="list" title="No movements yet" hint="Add a buy or sell movement above." />
    )}
  </>
);

export default CoinDetailView;

type MovementRowProps = {
  movement: CoinFile["movements"][number];
  groupId: string;
  coinId: string;
};

export const MovementRow: FC<MovementRowProps> = ({ movement, groupId, coinId }) => {
  const total = movement.amount * movement.pricePerCoin;
  const dateStr = new Date(movement.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <tr id={`mov-${movement.id}`} class="hover:bg-gray-900/50">
      <td class="py-3 pr-4 text-gray-400">{dateStr}</td>
      <td
        class={`py-3 pr-4 font-medium ${movement.type === "buy" ? "text-pnl-positive" : "text-pnl-negative"}`}
      >
        {movement.type.toUpperCase()}
      </td>
      <td class="py-3 pr-4 text-right">{movement.amount}</td>
      <td class="py-3 pr-4 text-right">{fmtUsd(movement.pricePerCoin)}</td>
      <td class="py-3 pr-4 text-right">{fmtUsd(total)}</td>
      <td class="py-3 pr-4 text-gray-400 max-w-[200px] truncate">{movement.note || "—"}</td>
      <td class="py-3 text-right w-10">
        <button
          type="button"
          hx-delete={`/groups/${groupId}/coins/${coinId}/movements/${movement.id}`}
          hx-target={`#mov-${movement.id}`}
          hx-swap="outerHTML"
          data-confirm-delete
          title="Delete movement"
          class="text-gray-600 hover:text-red-400 transition-colors p-1 rounded"
        >
          <Icon name="trash-2" class="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
