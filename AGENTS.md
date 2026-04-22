# AGENTS.md

## Project Stack

- **Runtime:** Bun (exclusive — no Node.js tooling)
- **Framework:** Hono on Bun.serve — server-rendered HTML via JSX views
- **Frontend:** HTMX for dynamic interactions, Tailwind v4 for styling. No client-side JS framework.
- **Storage:** JSON files on disk via `node:fs/promises` under `data/groups/`
- **Testing:** `bun:test`
- **Linting/Formatting:** Biome

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Bun-First Rules

This project uses **Bun** as the exclusive runtime, package manager, and test runner. Only fall back to Node ecosystem when Bun has no equivalent, the equivalent is experimental, or a dependency requires it. When breaking the rule, leave a one-line comment stating why.

### Runtime & tooling

- Run TS/JSX directly: `bun run file.ts` — no `tsc`, `ts-node`, `tsx`, `esbuild-register`.
- Watch mode: `bun --hot src/index.tsx` — no `nodemon`.
- Package manager: `bun install / add / remove / update` — never `npm`, `yarn`, `pnpm`.
- Lockfile: `bun.lock` (text). Commit it.
- Testing: `import { test, expect, mock, spyOn } from "bun:test"` — no `jest`, `vitest`, `mocha`.
- Scripts: `#!/usr/bin/env bun` shebang.

### HTTP & networking

- Server: Hono on Bun.serve. No `express`, `fastify`, `koa`, `hapi`.
- HTTP client: global `fetch`. No `axios`, `node-fetch`, `got`, `undici`.

### Filesystem

- Read: `Bun.file(path).text() | .json() | .bytes() | .stream()`.
- Write: `Bun.write(path, data)`.
- Fall back to `node:fs/promises` for operations Bun does not wrap (e.g. `readdir`, `mkdir`, `rm`, `rename`).

### Env vars

- `Bun.env` or `process.env`. `.env`, `.env.local`, `.env.<NODE_ENV>` are auto-loaded. No `dotenv`.

## Architecture

### Server rendering

- Views in `src/views/` use Hono JSX (`hono/jsx`). They return full HTML pages or HTMX fragments.
- Routes in `src/routes/` handle HTTP and render views directly — no API + SPA split.
- Layout wrapper (`src/views/layout.tsx`) provides the HTML shell with CSS and HTMX script.

### HTMX pattern

- Dynamic interactions use declarative HTMX attributes (`hx-get`, `hx-post`, `hx-delete`, `hx-target`, `hx-swap`).
- Inline JavaScript (`<script>`) only when strictly necessary (e.g. client-side sort).
- HTMX is self-hosted at `public/htmx.min.js`.

### CSS

- Tailwind v4 via `@tailwindcss/cli`.
- Input: `src/styles/input.css`. Output: `public/app.css` (gitignored).
- Build: `bun run build:css`. Watch: `bun run watch:css`.

### Data persistence

- JSON files under `data/groups/<group-slug>/` — one `group.json` + `coins/<coin-id>.json` per group.
- `src/lib/storage.ts` handles all file I/O with advisory locking.
- `src/lib/calc.ts` computes derived values (holding, P&L) from movements + live prices.
- `src/lib/coingecko.ts` fetches prices with a 60s in-memory cache.

## TypeScript (mandatory, strict)

All source files are `.ts` / `.tsx`. No plain `.js` in `src/`. Config in `tsconfig.json`:

- `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`
- `jsx: "react-jsx"`, `jsxImportSource: "hono/jsx"`

Rules:
- No `any`. Use `unknown` + narrowing.
- No `@ts-ignore`. `@ts-expect-error` only with an inline reason comment.
- No non-null assertions (`!`) except in tests.

## Biome (formatter + linter)

Biome is the only formatter/linter. No `prettier`, no `eslint`.

- Config: `biome.json` at repo root.
- Commands: `bun run lint` (fix), `bun run lint:ci` (check only).
- Format: `bun x biome format --write .`

## Project hygiene

- Pin exact Bun version: `"packageManager": "bun@1.3.13"` in `package.json`.
- No `node_modules/.bin` indirection — use `bun x <tool>` or `bunx <tool>`.

## Verification checklist (run before every PR)

1. `bun run lint:ci` passes.
2. `bun run typecheck` passes — no type errors.
3. `bun test` passes.
4. No `require(...)` calls — ESM only.

## Reference

- Bun APIs: https://bun.com/docs/runtime/bun-apis
- `Bun.serve`: https://bun.com/docs/api/http
- `bun:test`: https://bun.com/docs/cli/test
- Hono: https://hono.dev
- HTMX: https://htmx.org/docs/
- Tailwind v4: https://tailwindcss.com/docs
- Biome: https://biomejs.dev
