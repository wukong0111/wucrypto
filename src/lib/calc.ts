import type { Movement } from "./storage";

export type CoinDerived = {
  holding: number;
  costBasis: number;
  currentValueUsd: number | null;
  pnl: number | null;
  pnlPct: number | null;
};

export type GroupSummary = {
  totalValueUsd: number;
  totalPnl: number;
};

export function calcHolding(movements: Movement[]): number {
  let holding = 0;
  for (const m of movements) {
    if (m.type === "buy") holding += m.amount;
    else holding -= m.amount;
  }
  return holding;
}

export function calcCostBasis(movements: Movement[]): number {
  let costBasis = 0;
  for (const m of movements) {
    const total = m.amount * m.pricePerCoin;
    if (m.type === "buy") costBasis += total;
    else costBasis -= total;
  }
  return costBasis;
}

export function calcPnl(movements: Movement[], priceUsd: number | null): CoinDerived {
  const holding = calcHolding(movements);
  const costBasis = calcCostBasis(movements);

  if (priceUsd === null) {
    return { holding, costBasis, currentValueUsd: null, pnl: null, pnlPct: null };
  }

  const currentValueUsd = holding * priceUsd;
  const pnl = currentValueUsd - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : null;

  return { holding, costBasis, currentValueUsd, pnl, pnlPct };
}

export function calcGroupSummary(
  coins: Array<{ movements: Movement[]; priceUsd: number | null }>,
): GroupSummary {
  let totalValueUsd = 0;
  let totalPnl = 0;
  for (const coin of coins) {
    const derived = calcPnl(coin.movements, coin.priceUsd);
    if (derived.currentValueUsd !== null && derived.pnl !== null) {
      totalValueUsd += derived.currentValueUsd;
      totalPnl += derived.pnl;
    }
  }
  return { totalValueUsd, totalPnl };
}
