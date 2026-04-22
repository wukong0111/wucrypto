import { describe, expect, test } from "bun:test";
import { calcCostBasis, calcGroupSummary, calcHolding, calcPnl } from "./calc";
import type { Movement } from "./storage";

const buy = (amount: number, price: number): Movement => ({
  id: "1",
  type: "buy",
  date: "2026-01-01T00:00:00Z",
  amount,
  pricePerCoin: price,
  note: "",
});

const sell = (amount: number, price: number): Movement => ({
  id: "2",
  type: "sell",
  date: "2026-02-01T00:00:00Z",
  amount,
  pricePerCoin: price,
  note: "",
});

describe("calcHolding", () => {
  test("empty movements returns 0", () => {
    expect(calcHolding([])).toBe(0);
  });

  test("only buys", () => {
    expect(calcHolding([buy(0.5, 40000), buy(0.3, 45000)])).toBeCloseTo(0.8);
  });

  test("buys minus sells", () => {
    expect(calcHolding([buy(1, 40000), sell(0.4, 50000)])).toBeCloseTo(0.6);
  });

  test("negative holding when sold more", () => {
    expect(calcHolding([buy(0.5, 40000), sell(1, 50000)])).toBeCloseTo(-0.5);
  });
});

describe("calcCostBasis", () => {
  test("empty returns 0", () => {
    expect(calcCostBasis([])).toBe(0);
  });

  test("only buys", () => {
    expect(calcCostBasis([buy(0.5, 40000), buy(0.3, 45000)])).toBeCloseTo(33500);
  });

  test("buys minus sells", () => {
    expect(calcCostBasis([buy(1, 40000), sell(0.4, 50000)])).toBeCloseTo(20000);
  });
});

describe("calcPnl", () => {
  test("null price returns null values", () => {
    const result = calcPnl([buy(1, 40000)], null);
    expect(result.holding).toBe(1);
    expect(result.costBasis).toBe(40000);
    expect(result.currentValueUsd).toBeNull();
    expect(result.pnl).toBeNull();
    expect(result.pnlPct).toBeNull();
  });

  test("positive pnl", () => {
    const result = calcPnl([buy(1, 40000)], 50000);
    expect(result.holding).toBe(1);
    expect(result.costBasis).toBe(40000);
    expect(result.currentValueUsd).toBe(50000);
    expect(result.pnl).toBe(10000);
    expect(result.pnlPct).toBeCloseTo(25);
  });

  test("negative pnl", () => {
    const result = calcPnl([buy(1, 50000)], 40000);
    expect(result.pnl).toBe(-10000);
    expect(result.pnlPct).toBeCloseTo(-20);
  });

  test("zero cost basis returns null pnlPct", () => {
    const result = calcPnl([], 50000);
    expect(result.pnlPct).toBeNull();
  });
});

describe("calcGroupSummary", () => {
  test("aggregates multiple coins", () => {
    const result = calcGroupSummary([
      { movements: [buy(1, 40000)], priceUsd: 50000 },
      { movements: [buy(10, 2000)], priceUsd: 3000 },
    ]);
    expect(result.totalValueUsd).toBeCloseTo(80000);
    expect(result.totalPnl).toBeCloseTo(20000);
  });

  test("skips coins with null price", () => {
    const result = calcGroupSummary([
      { movements: [buy(1, 40000)], priceUsd: 50000 },
      { movements: [buy(1, 2000)], priceUsd: null },
    ]);
    expect(result.totalValueUsd).toBeCloseTo(50000);
    expect(result.totalPnl).toBeCloseTo(10000);
  });

  test("empty array returns zeros", () => {
    const result = calcGroupSummary([]);
    expect(result.totalValueUsd).toBe(0);
    expect(result.totalPnl).toBe(0);
  });
});
