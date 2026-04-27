# Food Planner

ShelfChef is a Next.js App Router application for pantry tracking, meal planning,
and MCP-based provider integrations.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication

- The main application at `/` now requires an authenticated user session.
- Unauthenticated visitors are redirected to the built-in Auth.js sign-in page.
- After signing in, users return to the protected route they originally requested.

Configure the app-level auth providers before starting the app:

```bash
AUTH_SECRET=your-auth-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

For the LLM-backed planner routes, configure a model provider before starting the app:

```bash
# Shared provider and model for every LLM-backed route
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash

# Provide one matching API key, or use LLM_API_KEY instead
GEMINI_API_KEY=your-google-api-key
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional Gemini-only web search
LLM_ENABLE_GOOGLE_SEARCH=true
```

Supported providers are `gemini`, `openai`, and `anthropic`. You can also encode the provider directly into `LLM_MODEL`, for example `openai:gpt-4.1-mini` or `anthropic:claude-sonnet-4-0`.

## MCP Playground

After signing in, you can test MCP OAuth provider connections at `/playground/mcp`.
The playground is separate from the main planner UI and uses the existing MCP
integration routes for connect, disconnect, and tool invocation.

Configure MCP provider credentials with the matching environment variables:

```bash
MCP_NOTION_MCP_CLIENT_ID=your-notion-client-id
MCP_NOTION_MCP_CLIENT_SECRET=your-notion-client-secret
MCP_GITHUB_MCP_CLIENT_ID=your-github-client-id
MCP_GITHUB_MCP_CLIENT_SECRET=your-github-client-secret
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) for local and hosted fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
