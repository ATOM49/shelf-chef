<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev              # Start dev server (Turbopack)
npm run build             # prisma generate && next build
npm run lint               # ESLint (flat config, eslint-config-next)
npx tsc --noEmit           # Type-check (no dedicated script; strict mode is on)

npm run db:validate        # Validate prisma/schema.prisma
npm run db:generate        # Regenerate Prisma client into generated/prisma (explicit in Prisma 7)
npm run db:push            # Push schema to DATABASE_URL directly (no migration file)
npm run db:migrate         # Apply checked-in migrations (prisma migrate deploy) — use for real deploys

npm run test:e2e                                # Full Playwright suite
npx playwright test e2e/example.spec.ts         # Single e2e test file
npx playwright test -g "test name"              # Single test by name
```

Playwright's `webServer` boots `npm run dev` itself and expects `ENABLE_DEV_LOGIN=true` and `DEV_LOGIN_PASSWORD` set in `.env.local` — e2e auth goes through the dev-only `/api/dev-login` route (`e2e/auth.setup.ts`), not real Google OAuth. That route is hard-gated off in production (`isDevLoginEnabled` in `src/auth.ts`) regardless of env vars.

There is no unit test runner configured — Playwright e2e is the only automated test suite.

## Local Node/npm validation

The repo targets Node 20. When validating local server startup or dependency metadata, prefer switching to Node 20 if it is available. If the current shell is a newer Node version and `npm install`/lockfile refresh is blocked only by the repo's Node 20 engine check (`EBADENGINE`, `EBADDEVENGINES`, or engine-strict output), rerun the same npm metadata command with `--force`, state that this is only overriding npm's engine gate, and then verify with the direct project commands above (`npm run lint`, `npx tsc --noEmit`, or targeted Playwright). Do not use `--force` to ignore actual build, type, lint, test, or runtime failures.

## Architecture

### State model: client-owned reducer + server sync, not API-per-action

The whole app's data — fridge/pantry layout, inventory, recipes, weekly plan, grocery cart — lives in one `AppState` object (`lib/appState.ts`) manipulated by a single `appReducer(state, action)`. There is no server round-trip per mutation:

- `FoodPlannerApp` (dynamically imported, `ssr: false`, via `components/app/FoodPlannerAppClient.tsx`) holds `AppState` in React state/reducer and drives every feature (storage, planner, stocking, grocery).
- `lib/persistence.ts` mirrors that state to `localStorage` (per-workspace keys, e.g. `stockpot-workspace-state-v1:<workspace>`) and handles migration from several legacy key schemes (`food-planner-*` → `stockpot-*`, single-fridge layout → fridge+pantry).
- `app/api/state/route.ts` is the only server sync point: it reads/writes the same `AppState` JSON blob to Postgres (`UserAppState.state` or `HouseholdAppState.state`, both `Json` columns), gated by workspace.
- When adding a new piece of app data, it almost always belongs as a field on `AppState` plus a case in `appReducer`, not a new API route/table.

### Workspaces: personal vs. household

A `Workspace` (`lib/households/shared.ts`) is either `{ type: "personal" }` or `{ type: "household", householdId }`. Nearly every state read/write (localStorage key, `/api/state` query params, `ensureUserWorkspaceBootstrap`) is workspace-scoped so the same reducer/UI works for both an individual's data and a shared household's data. `lib/households/server.ts` has the Prisma-side logic (membership checks, bootstrapping `UserAppState`/`HouseholdAppState` rows, invites).

### Auth

NextAuth v5 (beta) in `src/auth.ts`, Google OAuth only (GitHub provider present but commented out), **database session strategy** via `@auth/prisma-adapter` — not JWT. `requireUser()` (`src/lib/auth/session.ts`) gates the authenticated app shell (`app/page.tsx`); unauthenticated users land on `/signin`. On every sign-in, `ensureUserWorkspaceBootstrap` guarantees a `UserAppState` row exists.

### LLM abstraction: one call site, three providers

`lib/ai/structured.ts` (`generateStructuredObject` / `generateStructuredObjectFromImage`) is the sole entry point for structured LLM output. It resolves provider/model from `LLM_PROVIDER` / `LLM_MODEL` (supports `provider:model` shorthand, e.g. `openai:gpt-4.1-mini`) across `gemini` (`ChatGoogle`, via `@langchain/google`), `openai`, and `anthropic`, always validating output against a Zod schema. It's wrapped in a trivial single-node LangGraph (`StateGraph`) rather than called directly — extend that graph if you need multi-step generation instead of adding ad-hoc retry logic. Optional Tavily web grounding is threaded through the same function via the `grounding` option.

Feature-specific prompt/schema pairs live next to their domain: `lib/planner/{prompts,schema}.ts`, `lib/stocking/{prompts,schema}.ts` — these call into `lib/ai/structured.ts`, they don't talk to provider SDKs directly.

### Domain logic lives in `lib/`, not in components or API routes

`lib/` is organized by domain, each independent of Next.js:

- `lib/inventory/` — units, normalization, staples, consumption math
- `lib/fridge/` — shelf/cell layout geometry for both fridge and pantry
- `lib/planner/` — weekly plan generation (`generatePlan.ts` calls the LLM via `lib/ai`), validation of recipes against current inventory, preferences
- `lib/recipes/` — resolving a recipe by dish name
- `lib/grocery/` — deriving the grocery cart from the weekly plan + inventory gaps
- `lib/stocking/` — AI-assisted bulk stocking (text/photo → inventory items)
- `lib/households/` — workspace + membership + invite logic (server-only pieces separated into `server.ts` vs. shared client-safe types in `shared.ts`)

API routes under `app/api/**` are thin: parse/auth, call into `lib/`, return JSON. Put business logic in `lib/`.

### MCP integrations

`src/lib/mcp/` implements OAuth (PKCE) + tool invocation against external MCP servers, registered in `src/lib/mcp/providers.ts` (`MCP_PROVIDERS`). Adding a provider means adding an entry there plus `MCP_<KEY>_CLIENT_ID`/`_CLIENT_SECRET` env vars — routes under `app/api/integrations/mcp/[provider]/**` and the `/playground/mcp` UI are generic over the registry. Tokens are persisted via `token-store.ts`.

### Prisma 7 specifics

- Client is generated to `generated/prisma` (not `node_modules/.prisma`), generator is `prisma-client`.
- The datasource URL is set in `prisma.config.ts` (loads `.env.local` via `@next/env`), **not** in `prisma/schema.prisma`.
- `lib/db.ts` connects via `@prisma/adapter-pg`, so `DATABASE_URL` must be a plain `postgres://...` string (not `prisma://`).
- Run `npm run db:generate` explicitly after any schema change — it is not implicit.


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->


<!-- headroom:memory-instructions -->
## Memory

Use the `headroom_memory` MCP server for persistent cross-session knowledge.

**Before** answering questions about prior decisions, conventions, project context,
architecture, user preferences, org info, codenames, debugging history, or anything
from past sessions — call `memory_search` first.

**After** making durable decisions, discovering conventions, or learning important
facts — call `memory_save` to persist them for future sessions.

Memory is your first source of truth for anything not visible in the current conversation.
