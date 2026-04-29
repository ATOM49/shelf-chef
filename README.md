# ShelfChef

**Live App:** [https://shelf-chef-zeta.vercel.app/](https://shelf-chef-zeta.vercel.app/)

![ShelfChef Screenshot](https://github.com/user-attachments/assets/b067d3ab-6d7f-4003-8f5d-67528d4de9ff)

ShelfChef is an AI-powered kitchen management app that helps you track your pantry inventory, plan weekly meals, generate recipes, and build grocery lists — all in one place.

## Features

- **Inventory tracking** — Organise your Fridge, Pantry, and Staples across named shelves. Add items with quantities and units.
- **AI stocking** — Describe what you have and let Gemini automatically populate your shelves. Use preset stocking options for common household setups.
- **Weekly meal planner** — Generate a full week of AI-suggested meals (Lunch & Dinner) based on what's in your inventory. See at a glance which meals are ready to cook and which are missing ingredients.
- **Recipe book** — Save and browse recipes generated for your plan. Each recipe links to a reference source and lists required ingredients.
- **Voice recipe generation** — Record a voice note describing a dish; ShelfChef transcribes it and generates a structured recipe.
- **Grocery list** — Automatically build a shopping list from the missing ingredients across your weekly plan.
- **Household support** — Create and switch between multiple households, each with their own inventory and plan.
- **MCP integrations** — Connect external tools via OAuth (Notion, GitHub) through the MCP playground at `/playground/mcp`.
- **Google sign-in** — Secure authentication via Google OAuth with per-user state persisted in PostgreSQL.

## Requirements

- Node.js 20.19.0 or later
- npm 10 or later
- A PostgreSQL database connection string
- Google OAuth credentials for app sign-in

## Local Setup

1. Install dependencies:

```bash
npm install
```

1. Copy the environment template to `.env.local`:

```bash
cp .env.example .env.local
```

Use `.env.local` for local development. Next.js reads it by default, and
`prisma.config.ts` now loads the same env files so Prisma CLI uses the same
database configuration.

1. Fill in the required environment variables:

```bash
AUTH_SECRET=your-auth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=verify-full
```

For Google OAuth, add this callback URL in the Google Cloud Console:

```text
http://localhost:3000/api/auth/callback/google
```

1. Validate the Prisma setup and generate the client:

```bash
npm run db:validate
npm run db:generate
```

1. Apply the schema to your database:

```bash
npm run db:push
```

1. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Prisma 7 Notes

- The Prisma datasource URL is configured in `prisma.config.ts`, not in `prisma/schema.prisma`.
- This app uses the Prisma 7 `prisma-client` generator with output in `generated/prisma`.
- `lib/db.ts` instantiates Prisma with `@prisma/adapter-pg`, so `DATABASE_URL` must be a direct `postgres://...` connection string.
- `prisma generate` is explicit in Prisma 7. Use `npm run db:generate` whenever you change the schema.
- For production deploys that run checked-in migrations, use `npm run db:migrate`.

## Authentication And Persistence

- The main application at `/` requires an authenticated user session.
- Unauthenticated visitors are redirected to the custom sign-in page.
- The Prisma adapter persists `User`, `Account`, and `Session` records.
- On successful sign-in, the app now also creates a default `UserAppState` row for that user if one does not already exist.
- The `/api/state` route also backfills missing app state records for older users before returning state.

GitHub OAuth environment variables are still listed in `.env.example`, but the
GitHub provider is currently disabled in `src/auth.ts`.

## LLM Planner Setup

For planner and recipe generation routes, configure a model provider:

```bash
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your-google-api-key
```

Supported providers are `gemini`, `openai`, and `anthropic`. You can also set
`LLM_MODEL` to a provider-prefixed model such as `openai:gpt-4.1-mini` or
`anthropic:claude-sonnet-4-0`.

Optional variables:

```bash
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
LLM_API_KEY=shared-provider-api-key
LLM_ENABLE_GOOGLE_SEARCH=true
```

## MCP Playground

After signing in, you can test MCP OAuth provider connections at `/playground/mcp`.
The playground uses the existing integration routes for connect, disconnect, and
tool invocation.

Optional provider credentials:

```bash
MCP_NOTION_MCP_CLIENT_ID=your-notion-client-id
MCP_NOTION_MCP_CLIENT_SECRET=your-notion-client-secret
MCP_GITHUB_MCP_CLIENT_ID=your-github-client-id
MCP_GITHUB_MCP_CLIENT_SECRET=your-github-client-secret
```

## Deployment

Before deploying, make sure your production environment provides:

- `AUTH_SECRET`
- `DATABASE_URL`
- OAuth provider credentials used by your auth configuration
- Any LLM or MCP provider credentials needed by the routes you use

On deploys that apply existing migrations, run:

```bash
npm run db:migrate
```

## Contact

For questions or feedback, reach out to **Abhilash Mirji** at [abhilashmirji1@gmail.com](mailto:abhilashmirji1@gmail.com).
