# AGENTS.md
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Bun-First Project Rules

This project uses **Bun** as the exclusive runtime, package manager, bundler, and test runner. Never use Node.js tooling or npm packages when a stable Bun-native equivalent exists.

## Core directive

Before writing or installing anything, check if Bun has a **stable native** API or built-in tool for it. Only fall back to the Node ecosystem when:

1. Bun has no equivalent at all, or
2. The Bun equivalent is explicitly marked **experimental** in current docs, or
3. A required framework ships its own Node-only driver.

When breaking the rule, leave a one-line comment stating which of the three cases applies.

## Mandatory Bun APIs (all stable as of Bun 1.3.x)

### Runtime & tooling

- Run TS/JSX directly: `bun run file.ts` — no `tsc`, `ts-node`, `tsx`, `esbuild-register`.
- Watch mode: `bun --hot entry.ts` — no `nodemon`.
- Package manager: `bun install / add / remove / update` — never `npm`, `yarn`, `pnpm`.
- Lockfile: `bun.lock` (text). Commit it. Delete any `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
- Testing: `import { test, expect, mock, spyOn } from "bun:test"` — no `jest`, `vitest`, `mocha`.
- Bundling: `bun build` — no `webpack`, `rollup`, `esbuild`, `tsup`, `parcel`.
- Standalone executables: `bun build --compile`.
- Scripts: `#!/usr/bin/env bun` shebang.

### HTTP & networking

- Server: `Bun.serve({ routes, fetch, websocket })` with the typed `routes` API. No `express`, `fastify`, `koa`, `hapi`.
  - If you need a higher-level router, use `hono` (runs natively on Bun.serve). Nothing else.
- WebSocket server: `Bun.serve({ websocket })`. No `ws`, `socket.io`.
- HTTP client: global `fetch`. No `axios`, `node-fetch`, `got`, `undici`.
- Cookies: `Bun.CookieMap` / `request.cookies`.

### Filesystem

- Read: `Bun.file(path).text() | .json() | .bytes() | .stream()`.
- Write: `Bun.write(path, data)` — accepts strings, Buffers, Blobs, Responses, ReadableStreams.
- Archives: `Bun.Archive` for tar / tar.gz. No `tar`, `adm-zip`.
- Fall back to `node:fs` only for operations Bun does not wrap.

### Databases

- **Embedded SQLite: `import { Database } from "bun:sqlite"`** — mature, use it.
- **Redis: `import { redis } from "bun"`** — no `ioredis`, `redis`, `node-redis`.
- **PostgreSQL / MySQL / MariaDB: use `postgres` (postgres.js) or `mysql2` — NOT `Bun.SQL`.**
  - `Bun.SQL` is marked stable but still has open production-grade bugs as of April 2026 (connection hangs after expected server errors like constraint violations, malformed CTEs, query builder edge cases). Do not use it for anything transactional or with non-trivial SQL.
  - Revisit when issues oven-sh/bun#22395 and oven-sh/bun#17368 are closed and 2+ releases pass without regressions.
- ORMs: Drizzle with the `postgres` driver is the default. Do not try to wire Drizzle onto `Bun.SQL`.

### Crypto & utilities

- Password hashing: `Bun.password.hash` / `Bun.password.verify` (argon2id by default). No `bcrypt`, `argon2`.
- Non-crypto hashing: `Bun.hash` (xxHash / wyhash).
- Cryptographic hashing: `crypto.subtle` (WebCrypto).
- Env vars: `Bun.env` or `process.env`. `.env`, `.env.local`, `.env.<NODE_ENV>` are auto-loaded. No `dotenv`, `dotenv-expand`.
- JSONC configs: `Bun.JSONC.parse`. No `jsonc-parser`, `comment-json`.
- Markdown: `Bun.markdown` (CommonMark). No `marked`, `markdown-it` for simple cases.
- Subprocess: `Bun.spawn` / `Bun.spawnSync`. No `child_process`, `execa`.
- Shell scripts in TS: `import { $ } from "bun"`. No `shelljs`, `zx`.
- HTML transforms: global `HTMLRewriter`. No `cheerio`, `jsdom` for streaming transforms.
- CLI args: `Bun.argv` + `util.parseArgs`. No `commander`, `yargs` for simple CLIs.

## Forbidden → required mapping

| Do not use                                   | Use instead                          |
| -------------------------------------------- | ------------------------------------ |
| `express`, `fastify`, `koa`, `hapi`          | `Bun.serve` (+ `hono` if needed)     |
| `axios`, `node-fetch`, `got`, `undici`       | global `fetch`                       |
| `ws`, `socket.io` (server)                   | `Bun.serve({ websocket })`           |
| `better-sqlite3`, `node:sqlite`              | `bun:sqlite`                         |
| `pg` (node-postgres)                         | `postgres` (postgres.js)             |
| `redis`, `ioredis`, `node-redis`             | `Bun.redis`                          |
| `bcrypt`, `argon2`                           | `Bun.password`                       |
| `dotenv`                                     | native `.env` loading                |
| `jest`, `vitest`, `mocha`                    | `bun:test`                           |
| `nodemon`, `tsx`, `ts-node`                  | `bun --hot` / `bun run`              |
| `esbuild`, `webpack`, `rollup`, `tsup`       | `bun build`                          |
| `child_process`, `execa`, `zx`, `shelljs`    | `Bun.$` / `Bun.spawn`                |
| `npm`, `yarn`, `pnpm`                        | `bun`                                |
| `tar`, `adm-zip`                             | `Bun.Archive`                        |
| `jsonc-parser`, `comment-json`               | `Bun.JSONC`                          |
| `prettier`, `eslint`, `@typescript-eslint/*` | `@biomejs/biome`                     |

## Language & code quality

### TypeScript (mandatory, strict)

All source files are `.ts` / `.tsx`. No plain `.js` in `src/`. `tsconfig.json` must enable at minimum:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "module": "Preserve",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "types": ["bun"]
  }
}
```

Rules:
- No `any`. Use `unknown` + narrowing.
- No `@ts-ignore`. `@ts-expect-error` only with an inline reason comment.
- No non-null assertions (`!`) except in tests.
- Runtime validation (Zod/Valibot/ArkType) at every external boundary (HTTP, DB rows, env).
- `bun tsc --noEmit` (or equivalent typecheck) must pass in CI.

### Biome (formatter + linter)

Biome is the only formatter/linter. No `prettier`, no `eslint`, no `@typescript-eslint/*`.

- Install: `bun add -d --exact @biomejs/biome`
- Config: `biome.json` at repo root.
- Commands: `bun x biome format --write .`, `bun x biome lint .`, `bun x biome check --write .`
- Pre-commit / CI: `bun x biome ci .` must pass.
- Editor: use the official Biome extension (VS Code / Zed / Helix via LSP).

## Project hygiene

- Pin exact Bun version in `package.json` → `"packageManager": "bun@<exact-version>"`.
- Docker base image: `oven/bun:<exact-version>-slim`, multi-stage build.
- CI: `bun install --frozen-lockfile` → `bun x biome ci .` → `bun tsc --noEmit` → `bun test` → `bun build`.
- No `node_modules/.bin` indirection — call tools with `bun x <tool>` or `bunx <tool>`.

## Verification checklist (run before every PR)

1. No package from the forbidden table appears in `dependencies` or `devDependencies` of `package.json`. Check with `bun pm ls --depth 0`. Transitive deps don't count.
2. No `require(...)` calls — ESM only.
3. `grep -rE "from 'express'|from 'axios'|from 'pg'|from 'ioredis'|from 'bcrypt'|from 'dotenv'|from 'better-sqlite3'"` returns nothing.
4. `bun x biome ci .` passes.
5. `bun tsc --noEmit` passes — no type errors.
6. `bun test` and `bun build` both succeed.
7. Any Node-ecosystem package in `package.json` has an adjacent comment explaining why Bun cannot cover it.

## Reference

- Bun APIs: https://bun.com/docs/runtime/bun-apis
- `bun:sqlite`: https://bun.com/docs/api/sqlite
- `Bun.serve`: https://bun.com/docs/api/http
- `bun:test`: https://bun.com/docs/cli/test
- postgres.js: https://github.com/porsager/postgres
- Biome: https://biomejs.dev
- HTMX: https://htmx.org/docs/
