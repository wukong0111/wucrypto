# AGENTS.md

## Project Stack

- **Runtime:** Bun (exclusive — no Node.js tooling)
- **Framework:** Hono on Bun.serve — server-rendered HTML via JSX views
- **Frontend:** HTMX for dynamic interactions, Tailwind v4 for styling. No client-side JS framework.
- **Storage:** PostgreSQL via Drizzle ORM (`src/lib/db/`)
- **Testing:** `bun:test` (unit) + Playwright (e2e in `e2e/`)
- **Linting/Formatting:** Biome

## Behavioral Guidelines

Bias toward caution over speed. For trivial tasks, use judgment.

- **Think before coding:** State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If something is unclear, stop and ask. Push back when a simpler approach exists.
- **Simplicity first:** Minimum code that solves the problem. No features, abstractions, flexibility, or error handling beyond what was asked. If 200 lines could be 50, rewrite it.
- **Surgical changes:** Touch only what you must. Match existing style. Don't refactor working code or "improve" adjacent formatting. Mention unrelated dead code — don't delete it. Clean up imports/variables your changes made unused.
- **Goal-driven execution:** For multi-step tasks, state a brief plan with verify steps, then loop until verified.

## Bun-First Rules

Bun is the exclusive runtime, package manager, and test runner. Only fall back to Node ecosystem when Bun has no equivalent, it's experimental, or a dependency requires it (leave a one-line comment stating why).

- Package manager: `bun install / add / remove / update` only. Commit `bun.lock`.
- Filesystem: `Bun.file(path)` to read, `Bun.write(path, data)` to write. Fall back to `node:fs/promises` for `readdir`, `mkdir`, `rm`, `rename`.
- HTTP: Hono on Bun.serve (no express/fastify/koa/hapi). HTTP client: global `fetch` (no axios/node-fetch/got/undici).
- Env: `Bun.env` / `process.env`. Auto-loaded from `.env` files. No `dotenv`.
- Hygiene: `"packageManager": "bun@1.3.13"` pinned in `package.json`. Use `bun x <tool>` or `bunx <tool>`, never `node_modules/.bin`.

## Architecture

### Server rendering

- Views in `src/views/` use Hono JSX (`hono/jsx`) — full HTML pages or HTMX fragments.
- Routes in `src/routes/` handle HTTP and render views directly — no API + SPA split.
- Layout wrapper: `src/views/layout.tsx` (HTML shell with CSS + HTMX script).

### HTMX pattern

- Dynamic interactions via declarative attributes (`hx-get`, `hx-post`, `hx-delete`, `hx-target`, `hx-swap`).
- Inline `<script>` only when strictly necessary (e.g. client-side sort).
- HTMX self-hosted at `public/htmx.min.js`.

### CSS

- Tailwind v4 via `@tailwindcss/cli`. Input: `src/styles/input.css`. Output: `public/app.css` (gitignored).
- `bun run build:css` / `bun run watch:css`.

### Data persistence

- Schema (`src/lib/db/schema.ts`): `users → groups → coins → movements`.
- `src/lib/storage.ts` wraps all DB queries. `src/lib/calc.ts` computes holdings/P&L from movements + live prices. `src/lib/coingecko.ts` fetches prices with 60s in-memory cache.
- Migrations in `drizzle/` applied via `scripts/migrate.ts`.

### E2E testing (Playwright)

Frontend changes are verified with Playwright e2e tests on top of unit tests.

- Config: `playwright.config.ts`. Tests in `e2e/*.spec.ts`. Run: `bun run test:e2e` (or `:ui` for interactive).
- `webServer` boots `bun src/index.tsx` against test DB `wucrypto_test` with `MOCK_COINGECKO_API_KEY`. `reuseExistingServer: true` — kill stale server on port 3000 before clean run.
- Unit tests (`bun run test`) scoped to `src/` so Playwright specs aren't picked up.
- Workflow: implement → add/update `routes.test.ts` → add e2e spec (register → configure → exercise feature → assert) → prefer `expect(locator).toBeVisible()` over `waitForTimeout`, assert on state not sleeps → `bun run build:css` if CSS changed.

## TypeScript (mandatory, strict)

All source files are `.ts`/`.tsx` (no plain `.js` in `src/`). Strict config in `tsconfig.json` — read it for exact flags. Rules:

- No `any` — use `unknown` + narrowing.
- No `@ts-ignore`. `@ts-expect-error` only with inline reason comment.
- No non-null assertions (`!`) except in tests.

## Biome (only formatter/linter)

No `prettier`, no `eslint`. Config: `biome.json`. `bun run lint` (fix) / `bun run lint:ci` (check) / `bun x biome format --write .`.

## Deployment

PR merge into `main` triggers `Deploy to Railway` (`.github/workflows/deploy.yml`). Include `[no-build]` or `[skip-deploy]` in PR title to merge without deploying.

## Verification checklist (before every PR)

1. `bun run lint:ci` green.
2. `bun run typecheck` green.
3. `bun run test` green (+ `bun run test:e2e` for frontend changes, after `bun run build:css` if CSS changed).
4. No `require(...)` — ESM only.