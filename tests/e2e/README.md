# Shelf Chef – E2E Tests

Playwright end-to-end tests covering the core user flows.

## Prerequisites

- Node.js (same version as the app – see `engines` in `package.json`)
- A PostgreSQL database reachable from your machine (staging or local)
- The app running at `http://localhost:3000` (or set `TEST_BASE_URL`)
- `ffmpeg` for video conversion (optional – see §Video)

## Quick start

```bash
# 1. Install dependencies (including @playwright/test)
npm ci

# 2. Install Playwright browsers
npx playwright install --with-deps chromium

# 3. Create the local env file
cp tests/e2e/.env.test.example tests/e2e/.env.test
# Then fill in DATABASE_URL and any other required variables

# 4. Start the app in a separate terminal
npm run dev        # or: npm run build && npm run start

# 5. Run the tests
npm run test:e2e
```

## Environment variables

Create `tests/e2e/.env.test` (git-ignored) with at minimum:

```
DATABASE_URL=postgres://user:password@localhost:5432/shelfchef_staging
AUTH_SECRET=<any-32-char-random-string>
TEST_BASE_URL=http://localhost:3000   # optional, defaults to http://localhost:3000
```

See `.env.example` at the repo root for the full list of variables the app needs at runtime.

## Running tests

| Command | What it does |
|---|---|
| `npm run test:e2e` | Run all e2e tests (headless) |
| `npm run test:e2e:ui` | Open the Playwright interactive UI |

## Viewing the HTML report

After a test run, open the HTML report:

```bash
npx playwright show-report tests/e2e/report
```

## Video recordings

Playwright records every test as `.webm` inside `tests/e2e/videos/`.

To convert to `.mp4` (better GitHub/README embedding):

```bash
# Install ffmpeg first if not already available
sudo apt-get install -y ffmpeg   # Ubuntu/Debian
brew install ffmpeg               # macOS

# Convert
npm run test:e2e:convert
```

The `.mp4` files are written alongside the `.webm` files in `tests/e2e/videos/`.

## Auth strategy

Tests bypass Google OAuth entirely.

`global-setup.ts` seeds a deterministic `User` + `Session` row into the staging database, then writes `tests/e2e/.auth/user.json` with the `authjs.session-token` cookie. Playwright auto-injects this cookie for every test in the `chromium` project.

`global-teardown.ts` deletes all test-user rows from the database after the run.

## API mocking

All LLM-backed routes (`/api/stock`, `/api/stock/preset`, `/api/planner/generate`, `/api/recipes/generate`, `/api/recipes/generate/custom`) are intercepted with static JSON fixtures from `tests/e2e/fixtures/`. No real Gemini/LLM calls are made during tests.

## CI

Tests run automatically in GitHub Actions on every `push` to `main` and every pull request, as well as on `workflow_dispatch` for manual recording runs. See `.github/workflows/e2e.yml`.

Required GitHub repository secrets:

| Secret | Description |
|---|---|
| `DATABASE_URL` | Connection string for the staging PostgreSQL database |
| `AUTH_SECRET` | Auth.js secret (any 32-char random string is fine for tests) |
| `GEMINI_API_KEY` | Can be a dummy value — all LLM routes are mocked |
