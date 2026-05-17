## Why

CoinGecko's public API has aggressive rate limits. Currently the app uses a single global API key from environment variables, which means all users share one quota. If one user exhausts it, everyone loses price data. Allowing each user to bring their own CoinGecko API key isolates rate limits and improves reliability.

## What Changes

- Add `coingeckoApiKey` column to the `users` table (nullable text).
- Add a UI form for authenticated users to set/update their personal CoinGecko API key.
- Update `src/lib/coingecko.ts` to accept an optional per-user API key instead of always reading from env.
- Update `src/lib/calc.ts` and any route handlers that fetch prices to pass the current user's key down to the price-fetching layer.
- **BREAKING**: Remove the global `COINGECKO_API_KEY` env var completely — no fallback. If a user has no personal key, the system redirects them to settings with an error.

## Capabilities

### New Capabilities
- `per-user-coingecko-key`: Allow each user to store and use their own CoinGecko API key for price fetching and search.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- Database schema: new column on `users`.
- Drizzle migration required.
- `src/lib/coingecko.ts` signature changes.
- Any callers of `fetchPrices` and `searchCoins` need to pass a user key.
- New UI fragment for API key management.
