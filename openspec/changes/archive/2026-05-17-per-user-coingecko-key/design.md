## Context

Currently `src/lib/coingecko.ts` reads a single `COINGECKO_API_KEY` from environment variables and applies it to every outgoing request. All users share this key, so one user can exhaust the shared rate limit and break price data for everyone. CoinGecko offers free demo API keys with individual quotas; letting each user supply their own key isolates usage and improves reliability.

The auth middleware already injects `user` (id, username) into the Hono context. `validateSession` queries the `users` table, so extending the returned user object to include the new key is straightforward.

## Goals / Non-Goals

**Goals:**
- Let authenticated users save a personal CoinGecko API key.
- Validate the key against CoinGecko before persisting it; reject invalid keys.
- Use the user's key for `fetchPrices` and `searchCoins`.
- Redirect users without a key to `/settings` with an error message instead of falling back.
- Keep the in-memory price cache working unchanged.

**Non-Goals:**
- Supporting CoinGecko paid-tier endpoints or plans.
- Encrypting the API key at rest (it is a demo key, low sensitivity).

## Decisions

### 1. Schema: add `coingeckoApiKey` to `users` table
A nullable `text` column is the simplest approach. No separate table needed.

### 2. Thread the key through function signatures
Change `fetchPrices(coinIds)` → `fetchPrices(coinIds, apiKey?)` and `searchCoins(query)` → `searchCoins(query, apiKey?)`. This keeps `coingecko.ts` free of auth/database dependencies and makes it trivial to test.

**Alternative considered:** pass the entire user object. Rejected because it couples the price layer to the user type.

### 3. Enforce key requirement with exempt-capable middleware
Add `apiKeyMiddleware` to `protectedRoutes` so it runs after `authMiddleware` on every authenticated route. The middleware maintains an internal exempt list (e.g. `/settings` and its subpaths, `/`, `/groups`) and calls `next()` immediately for those paths, avoiding redirect loops.

For non-exempt routes, if the user has no `coingeckoApiKey`, the middleware redirects to `/settings?error=missing_key`.

**HTMX handling:** The middleware checks for the `HX-Request` header. For HTMX requests without a key, it returns an inline error HTML fragment instead of a 302 redirect. This covers `/api/coins/search`.

**Alternative considered:** return null prices silently. Rejected because it creates a confusing UX where prices just don't appear with no explanation.

### 4. Validate keys before persistence
Before saving a submitted key, the system SHALL make a lightweight CoinGecko API call (e.g. `/ping` or `/simple/price?ids=bitcoin&vs_currencies=usd`) using the submitted key. If the response is non-2xx, the key is rejected and the user sees a form error. Only valid keys are written to the database.

**Alternative considered:** accept any string and validate lazily on first real request. Rejected because it leads to confusing UX where the user thinks they saved a key but prices still fail.

### 5. UI placement: settings page
Add a new section to the existing `settings.tsx` view with a form that posts to a new `POST /settings/coingecko-key` route. This matches the current pattern for username/password changes.

### 6. Cache remains global and key-agnostic
The 60-second price cache is keyed by coin ID list only. Prices are identical regardless of which API key fetched them, so there is no need to namespace the cache by key.

## Risks / Trade-offs

- **[Risk]** CoinGecko validation endpoint is down or slow → user cannot save even a valid key.
  - *Mitigation:* Use a lightweight endpoint (`/ping`) with a short timeout. If validation fails due to network, surface a clear message: "Unable to verify key right now, please try again."
- **[Risk]** User provides a valid but rate-limited key → validation passes but later requests fail.
  - *Mitigation:* Out of scope for this change. The validation only checks that the key is accepted by CoinGecko, not quota status.
- **[Risk]** First-time users hit a hard wall immediately after registering.
  - *Mitigation:* The settings page is the first thing they see; the error message should include a direct link to CoinGecko's API key registration page.
- **[Risk]** Keys are stored in plain text in the database.
  - *Mitigation:* These are demo API keys with limited value. Encryption can be added in a future change if the project later supports paid-tier keys.
