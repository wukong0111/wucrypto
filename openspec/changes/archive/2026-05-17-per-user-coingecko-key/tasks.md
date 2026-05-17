## 1. Database & Schema

- [x] 1.1 Add `coingeckoApiKey` nullable text column to `users` table in `src/lib/db/schema.ts`
- [x] 1.2 Generate Drizzle migration for the new column

## 2. Backend Changes

- [x] 2.1 Update `validateSession` in `src/lib/auth.ts` to return `coingeckoApiKey` alongside `id` and `username`
- [x] 2.2 Update auth middleware user type in `src/middleware/auth.ts` to include `coingeckoApiKey`
- [x] 2.3 Update `fetchPrices` and `searchCoins` in `src/lib/coingecko.ts` to accept a required `apiKey` parameter and remove env fallback logic
- [x] 2.4 Update `src/routes/coins.tsx` to pass `user.coingeckoApiKey` into `fetchPrices` and `searchCoins` calls; redirect to settings if missing
- [x] 2.5 Update `src/routes/movements.tsx` to pass `user.coingeckoApiKey` into `fetchPrices` calls; redirect to settings if missing
- [x] 2.6 Add `validateApiKey` helper in `src/lib/coingecko.ts` that makes a lightweight CoinGecko call and returns boolean
- [x] 2.7 Add `POST /settings/coingecko-key` route in `src/routes/` that validates the key before saving/clearing

## 3. UI Changes

- [x] 3.1 Add CoinGecko API key management section to `src/views/settings.tsx` with a form that posts to `/settings/coingecko-key`
- [x] 3.2 Display a prominent error banner on settings when `?error=missing_key` is present
- [x] 3.3 Display an inline form error when the submitted API key fails CoinGecko validation
- [x] 3.4 Include a link to CoinGecko's API key signup in the settings form

## 4. Key Enforcement

- [x] 4.1 Create `apiKeyMiddleware` in `src/middleware/` that checks `user.coingeckoApiKey`; redirects to `/settings?error=missing_key` for normal requests, returns inline HTML error for HTMX requests (`HX-Request` header)
- [x] 4.2 Add `apiKeyMiddleware` to `protectedRoutes` in `src/index.tsx` so it runs after `authMiddleware`
- [x] 4.3 Ensure the middleware exempts `/settings` (and its subpaths), `/`, and `/groups` to avoid redirect loops

## 5. Testing & Verification

- [x] 5.1 Update `src/lib/coingecko.test.ts` to cover the required `apiKey` parameter behavior
- [x] 5.2 Add tests for `validateApiKey` helper (valid key, invalid key, network failure)
- [x] 5.3 Add tests for redirect behavior when `coingeckoApiKey` is missing
- [x] 5.3 Run `bun run typecheck` and fix any errors
- [x] 5.4 Run `bun run lint:ci` and fix any issues
- [x] 5.5 Run `bun test` and ensure all tests pass
