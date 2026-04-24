import type { FC } from "hono/jsx";
import type { CoinDerived } from "../lib/calc";
import type { CoinFile } from "../lib/storage";

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

type CoinDetailViewProps = {
  coin: CoinFile;
  derived: CoinDerived;
  groupId: string;
};

const CoinDetailView: FC<CoinDetailViewProps> = ({ coin, derived, groupId }) => (
  <>
    <div class="mb-4">
      <a href={`/groups/${groupId}`} class="text-blue-400 hover:underline text-sm">
        &larr; Back to group
      </a>
    </div>

    <div id="coin-header" class="mb-6">
      <h1 class="text-2xl font-bold mb-2">
        {coin.name} <span class="text-gray-400 text-lg">{coin.symbol.toUpperCase()}</span>
      </h1>
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm">
        <div>
          <div class="text-gray-400">Holding</div>
          <div class="font-semibold">
            {derived.holding.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0")}
          </div>
        </div>
        <div>
          <div class="text-gray-400">Avg Price</div>
          <div class="font-semibold">
            {fmtUsd(derived.holding > 0 ? derived.costBasis / derived.holding : null)}
          </div>
        </div>
        <div>
          <div class="text-gray-400">Value</div>
          <div class="font-semibold">{fmtUsd(derived.currentValueUsd)}</div>
        </div>
        <div>
          <div class="text-gray-400">P&L</div>
          <div class={`font-semibold ${pnlColor(derived.pnl)}`}>{fmtUsd(derived.pnl)}</div>
        </div>
        <div>
          <div class="text-gray-400">P&L %</div>
          <div class={`font-semibold ${pnlColor(derived.pnl)}`}>{fmtPct(derived.pnlPct)}</div>
        </div>
      </div>
    </div>

    <h2 class="text-lg font-semibold mb-3">Add Movement</h2>
    <form
      hx-post={`/groups/${groupId}/coins/${coin.coinId}/movements`}
      hx-target="#movements-body"
      hx-swap="afterbegin"
      class="mb-6 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end"
    >
      <div>
        <label class="block text-xs text-gray-400 mb-1" for="mov-type">
          Type
        </label>
        <select
          id="mov-type"
          name="type"
          class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm"
        >
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1" for="mov-date">
          Date
        </label>
        <input
          id="mov-date"
          type="datetime-local"
          name="date"
          value={new Date().toISOString().slice(0, 16)}
          class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1" for="mov-amount">
          Amount
        </label>
        <input
          id="mov-amount"
          type="number"
          step="any"
          name="amount"
          required
          class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1" for="mov-price">
          Price/Coin (USD)
        </label>
        <input
          id="mov-price"
          type="number"
          step="any"
          name="pricePerCoin"
          required
          class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1" for="mov-note">
          Note
        </label>
        <input
          id="mov-note"
          type="text"
          name="note"
          class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
      >
        Add
      </button>
    </form>

    <h2 class="text-lg font-semibold mb-3">Movements</h2>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-gray-400 border-b border-gray-800">
          <th class="text-left py-2 pl-0 pr-3">Date</th>
          <th class="text-left py-2 px-3">Type</th>
          <th class="text-right py-2 px-3">Amount</th>
          <th class="text-right py-2 px-3">Price/Coin</th>
          <th class="text-right py-2 px-3">Total</th>
          <th class="text-left py-2 px-3">Note</th>
          <th class="text-right py-2 pl-3 pr-0" />
        </tr>
      </thead>
      <tbody id="movements-body">
        {[...coin.movements]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((m) => (
            <MovementRow key={m.id} movement={m} groupId={groupId} coinId={coin.coinId} />
          ))}
      </tbody>
    </table>

    {coin.movements.length === 0 && <p class="text-gray-500 text-sm mt-4">No movements yet.</p>}
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
  const dateStr = new Date(movement.date).toLocaleDateString();
  return (
    <tr id={`mov-${movement.id}`} class="border-b border-gray-800/50 hover:bg-gray-900">
      <td class="py-2 pl-0 pr-3">{dateStr}</td>
      <td
        class={`py-2 px-3 ${movement.type === "buy" ? "text-pnl-positive" : "text-pnl-negative"}`}
      >
        {movement.type.toUpperCase()}
      </td>
      <td class="py-2 px-3 text-right">{movement.amount}</td>
      <td class="py-2 px-3 text-right">{fmtUsd(movement.pricePerCoin)}</td>
      <td class="py-2 px-3 text-right">{fmtUsd(total)}</td>
      <td class="py-2 px-3 text-gray-400 max-w-[200px] truncate">{movement.note || "—"}</td>
      <td class="py-2 pl-3 pr-0 text-right">
        <button
          type="button"
          hx-delete={`/groups/${groupId}/coins/${coinId}/movements/${movement.id}`}
          hx-target={`#mov-${movement.id}`}
          hx-swap="outerHTML"
          data-confirm-delete
          class="text-gray-500 hover:text-red-400"
        >
          &times;
        </button>
      </td>
    </tr>
  );
};
