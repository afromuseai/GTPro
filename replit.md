# GTPro

An AI-powered algorithmic trading platform for real-time market analysis, Binance Futures execution, and autonomous bot fleet management.

## Run & Operate

- **Start all**: Run the `Project` workflow (runs API Server + Start application in parallel)
- **API Server only**: `PORT=3000 pnpm --filter @workspace/api-server run dev`
- **Frontend only**: `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/gtpro run dev`
- **DB push**: `pnpm --filter @workspace/db run push`
- **Typecheck**: `pnpm run typecheck`

Required env vars / secrets:
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `CLERK_SECRET_KEY` — Clerk backend secret key (stored in Replit Secrets)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (in `[userenv.shared]` in `.replit`)
- `SESSION_SECRET` — used for admin JWT signing + AES-256-GCM encryption (stored in Replit Secrets)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` — injected by Replit OpenAI integration

## Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS v4, Radix UI / shadcn, TanStack Query, Wouter, Framer Motion
- **Backend**: Node.js, Express 5, TypeScript (ESM), esbuild
- **Auth**: Clerk (`@clerk/react` + `@clerk/express`) with custom 2FA and admin layer
- **Database**: PostgreSQL 16 via Drizzle ORM (`drizzle-orm/node-postgres`)
- **AI**: OpenAI via Replit AI Integrations (chat completions, signal analysis)
- **Trading**: Binance Futures API (real execution), CoinGecko (price feeds via SSE)

## Where things live

```
artifacts/gtpro/        React frontend
artifacts/api-server/   Express backend (src/, build.mjs)
lib/db/                 Drizzle schema + DB connection (source of truth: lib/db/src/schema/)
lib/api-spec/           OpenAPI spec + orval codegen config
lib/api-zod/            Generated Zod schemas
lib/api-client-react/   Generated React Query hooks
scripts/post-merge.sh   Runs after task merges: pnpm install + typecheck + db push
```

## Architecture decisions

- **Monorepo with pnpm workspaces**: Frontend, backend, and shared libs are separate packages under one repo; `pnpm-workspace.yaml` defines the catalog.
- **Vite proxy for `/api`**: Frontend dev server proxies `/api` to `localhost:3000`; no CORS issues in dev.
- **Clerk proxy in production**: `clerkProxyMiddleware` proxies Clerk Frontend API through `/api/__clerk` so Replit `.app` domains work without DNS CNAME.
- **Hardcoded Clerk JWT public key**: Server verifies tokens offline using the embedded RSA public key — no secret key needed for JWT verification in dev.
- **AES-256-GCM for exchange keys**: Binance API credentials are encrypted at rest using `SESSION_SECRET` as the key derivation input (`lib/encrypt.ts`).

## Product

- Landing page with sign-in/sign-up via Clerk
- Onboarding flow → 2FA setup → trading dashboard
- Three autonomous bot fleets: ABF (AI signals), SBF (security), VCBF (validation)
- Real-time BTC/USDT price feed via SSE (CoinGecko)
- AI chat assistant (OpenAI gpt-4o-mini, streaming)
- Admin panel (email+password auth, separate from Clerk)
- Journal, billing, and fleet monitoring pages

## User preferences

- Keep existing Clerk authentication — do not replace with Replit Auth
- OpenAI used via Replit AI Integrations (no user-provided API key needed)

## Gotchas

- API server **must** start before the frontend makes requests; the `Project` workflow runs them in parallel but the frontend retries automatically.
- `PORT=5000` is required for the frontend webview workflow; `PORT=3000` for the API.
- DB schema push must be re-run after any schema changes: `pnpm --filter @workspace/db run push`
- `pnpm` only — the `preinstall` script blocks `npm` and `yarn`.
- Twilio SMS (2FA) is optional — only active when `TWILIO_*` secrets are set.

## Pointers

- DB schema: `lib/db/src/schema/`
- API routes: `artifacts/api-server/src/routes/`
- Frontend pages: `artifacts/gtpro/src/`
- Replit workflows skill: `.local/skills/workflows/SKILL.md`
- Replit env secrets skill: `.local/skills/environment-secrets/SKILL.md`
