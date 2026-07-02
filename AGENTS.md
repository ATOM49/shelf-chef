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
