# GTPro — Premium Algorithmic Trading Platform

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Product: GTPro (`artifacts/gtpro`)

A premium algorithmic trading platform with deep navy + gold UI.

### Phases Complete

**Phase 1** — Foundation: landing, dashboard, analysis, linked-accounts, settings pages with Clerk auth, AppLayout sidebar/topbar.

**Phase 2** — Bot Engine: `engine/bot-engine.tsx` global bot engine with P&L ticker, pause/resume/stop, activity log. Dashboard Bot Launcher + Active Bot Card.

**Phase 3** — AI Intelligence & Analysis Layer:
- `engine/signal-engine.tsx` — `SignalProvider` generates BUY/SELL/HOLD signals every 5–10s. Calls `/api/abf/analyze` (real AI) for AI-powered signals with VCBF validation.
- `pages/analysis.tsx` — Full intelligence dashboard with live signal card, confidence bar, market analysis, trade levels, market regime sidebar, animated signal history feed.

**Phase 4** — Real Data & AI Upgrades:
- **Live BTC price**: Server-side CoinGecko proxy (`/api/market/price`, `/api/market/stream` SSE). Polls every 5s, broadcasts to all connected clients.
- **Real AI signals**: ABF route (`/api/abf/analyze`) with JSON parsing. Deterministic fallback if AI fails.
- **AI Chat**: SSE streaming chat with conversational system prompt.

**Phase 5** — Binance Futures Real Execution:
- `lib/db/src/schema/exchange.ts` — `exchange_credentials` table (AES-256-GCM encrypted API keys per user)
- `artifacts/api-server/src/lib/encrypt.ts` — AES-256-GCM encrypt/decrypt using `SESSION_SECRET`
- `artifacts/api-server/src/lib/binance.ts` — Full Binance Futures REST client (USDT-M perpetual, HMAC-SHA256 signing)
- `artifacts/api-server/src/routes/exchange.ts` — exchange connect/status/order routes
- `artifacts/gtpro/src/engine/exchange-engine.tsx` — `ExchangeProvider` React context, polls status every 30s
- `artifacts/gtpro/src/engine/bot-engine.tsx` — Integrated with `useExchange()`: places real MARKET+LIMIT+STOP_MARKET orders

**Phase 6** — Vite Proxy Fix + Trade Journal:
- `artifacts/gtpro/vite.config.ts` — Vite proxy forwards `/api` → `http://localhost:3000` (fixes admin panel, market feed)
- `engine/market-data.tsx` — FeedState type: `connecting`/`live`/`reconnecting` (no more "Fallback Feed")
- `lib/db/src/schema/journal.ts` — `trade_journal` table schema
- `artifacts/api-server/src/routes/journal.ts` — CRUD routes `GET/POST/PATCH/DELETE /api/journal`
- `pages/journal.tsx` — Trade journal page: KPI stats, cumulative P&L chart (recharts), filterable table, auto-saves when bot closes a trade
- Auto-save: `executeSignal` in fleet-engine.tsx POSTs to `/api/journal` when a trade closes

**Phase 7** — Admin System:
- `lib/db/src/schema/admin.ts` — `admin_users` table
- `artifacts/api-server/src/routes/admin.ts` — `GET /api/admin/check?email=...` returns `{isAdmin, role}`
- `artifacts/gtpro/src/contexts/admin-auth.tsx` — `AdminAuthProvider` + `useAdminAuth()` hook
- `artifacts/gtpro/src/pages/admin.tsx` — Full admin panel at `/admin`
- **Admin accounts**: joshuaa2g5@gmail.com (password: Naesakim), starboywizikal@gmail.com (password: Sergeant@1965)
- **Admin bypass**: Admins skip both onboarding AND 2FA (checked in OnboardingGuard and TwoFAGuard)
- **Admin nav**: appears in sidebar only when `isAdmin === true`

**Phase 9** — UX Improvements & Real Session Management:
- **Active Sessions table** on Fleets page: fetches from `/api/fleet/sessions`, shows obfuscated IPs, request count, last-seen, with revoke/block button; polls every 10s
- **Fleet sessions endpoints**: `GET /api/fleet/sessions` (returns IP session data) + `POST /api/fleet/sessions/revoke` (blocks an IP in memory)
- **Wallet page loading fix**: shows spinner only while `isLoading`, then proper error state with retry button when user is null (was infinite spinner)
- **Landing LIVE POSITIONS terminal**: 5 animated rows with live-updating P&L values (per-row intervals), fleet column, system status strip (SBF/VCBF/latency/executions), premium titlebar
- **Landing pricing section**: full 3-tier pricing cards (Starter $25 / Professional $100 / Institutional $500) with features list, "Most Popular" highlight, inserted before CTA
- **Landing nav fix**: "Pricing" link now scrolls to `#pricing` (new section), not `#cta`
- **Landing logo**: navbar logo increased from `h-9` to `h-11`

**Phase 8** — Production Polish:
- Pricing upgraded to $299/mo (was $149)
- Terms & Privacy updated: removed all simulation/demo language, added proper risk disclosure
- QR code for 2FA now uses `qrcode.react` (QRCodeSVG from otpauth:// URI — no more spinner)
- Admin users redirected away from /setup-2fa page automatically
- DEV ONLY bypass button removed from sign-in/sign-up pages
- Clerk "Development mode" badge hidden via appearance elements + CSS
- Bot engine: "Simulation mode" → "Paper trading mode" (when no exchange connected)
- Billing 500 errors fixed: "User not found" returns 404 gracefully

### What's Real

| Feature | Status |
|---|---|
| BTC/USDT price feed | **Real** — CoinGecko via server SSE proxy, updates every 5s |
| AI trade signals (ABF) | **Real** — AI with full liquidity + order-flow context (deterministic fallback active) |
| AI chat assistant | **Real** — SSE streaming |
| 24h price change % | **Real** — from CoinGecko |
| Learning engine | **Real** — tracks signal outcomes, localStorage persistence |
| VCBF validation | **Real** — 5-check logic on every signal |
| Binance Futures execution | **Real** — USDT-M perpetual, MARKET entry + LIMIT TP + STOP_MARKET SL (if API key connected) |
| Trade journal | **Real** — PostgreSQL, auto-saved on signal close |
| SBF fleet metrics | **Real** — live API request tracking via middleware, SSE stream |
| VCBF health monitoring | **Real** — real API latency probes every 30s |
| ABF signal logging | **Real** — journal entry written on every signal close |
| HBF connectivity checks | **Real** — real API ping every 45s |

### Key Architecture

**Provider order (CRITICAL)**:
```
DevBypassProvider > QueryClientProvider > MarketDataProvider > LiquidityProvider >
LearningProvider > FleetProvider > ExchangeProvider > BotProvider > SignalProvider > WouterRouter > ClerkProvider
```

**Auth flow**:
1. User signs in via Clerk
2. `OnboardingGuard` checks admin status first — admins skip onboarding
3. `TwoFAGuard` checks admin status — admins skip 2FA
4. Non-admins: onboarding → 2FA setup → dashboard

**Binance execution flow**:
1. User connects at `/linked-accounts` → `POST /api/exchange/connect` validates keys, stores AES-256 encrypted
2. `ExchangeProvider` polls `/api/exchange/status` every 30s → exposes `status.connected`, `balance`
3. `BotProvider` reads `useExchange()` → when bot fires `enterTrade`, dispatches `placeEntry` to server
4. Server places: MARKET entry → LIMIT TP (reduceOnly) → STOP_MARKET SL (reduceOnly)

**Market data flow**:
1. `artifacts/api-server/src/routes/market.ts` — polls CoinGecko every 5s, broadcasts via SSE
2. `artifacts/gtpro/src/engine/market-data.tsx` — `useServerFeed()` connects to `/api/market/stream` EventSource

**Trade journal flow**:
1. `executeSignal` fires in fleet-engine.tsx when ABF approves a signal
2. After 4-7s (simulated execution delay), PnL is computed
3. `POST /api/journal` persists the entry to PostgreSQL
4. `/journal` page auto-refreshes and displays cumulative P&L chart

### Key Files

- `artifacts/gtpro/vite.config.ts` — Vite proxy config (key: `/api` → port 3000)
- `lib/db/src/schema/exchange.ts` — exchange_credentials Drizzle schema
- `lib/db/src/schema/journal.ts` — trade_journal Drizzle schema
- `artifacts/api-server/src/lib/encrypt.ts` — AES-256-GCM encryption for API keys
- `artifacts/api-server/src/lib/binance.ts` — Binance Futures REST client
- `artifacts/api-server/src/routes/exchange.ts` — exchange connect/status/order routes
- `artifacts/api-server/src/routes/journal.ts` — journal CRUD
- `artifacts/api-server/src/routes/market.ts` — CoinGecko price proxy + SSE broadcast
- `artifacts/api-server/src/routes/abf.ts` — AI signal analysis
- `artifacts/api-server/src/routes/chat.ts` — SSE chat
- `artifacts/gtpro/src/engine/exchange-engine.tsx` — ExchangeProvider context
- `artifacts/gtpro/src/engine/market-data.tsx` — server SSE primary + fallback
- `artifacts/gtpro/src/engine/signal-engine.tsx` — signal generation + ABF AI call
- `artifacts/gtpro/src/engine/fleet-engine.tsx` — VCBF validation, signal execution, journal auto-save
- `artifacts/gtpro/src/engine/learning/learning-engine.tsx` — win rate tracking
- `artifacts/gtpro/src/engine/bot-engine.tsx` — bot engine with real exchange integration
- `artifacts/gtpro/src/pages/dashboard.tsx` — PriceTicker, bot launcher, signal widget
- `artifacts/gtpro/src/pages/journal.tsx` — trade journal with P&L chart
- `artifacts/gtpro/src/pages/analysis.tsx` — AI intelligence dashboard
- `artifacts/gtpro/src/pages/billing.tsx` — pricing ($299/mo), usage stats
- `artifacts/gtpro/src/pages/linked-accounts.tsx` — real Binance connect + account management
- `artifacts/gtpro/src/pages/setup-2fa.tsx` — TOTP + phone 2FA (qrcode.react for QR)
- `artifacts/gtpro/src/components/chat-widget.tsx` — floating AI chat
- `artifacts/gtpro/src/components/layout.tsx` — sidebar + topbar

### Auth

Clerk auth (production keys recommended for deployment). Admin accounts bypass both onboarding and 2FA. The DEV ONLY bypass button has been removed.

### Binance Notes

- **Endpoint**: USDT-M Futures — `fapi.binance.com` (prod) or `testnet.binancefuture.com` (testnet)
- **Position size**: 0.1 BTC
- **Strategy**: MARKET entry → LIMIT TP (reduceOnly) + STOP_MARKET SL (reduceOnly)
- **Permissions**: API key needs Futures trading only — never withdrawal.

### Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI-compatible base URL for Replit AI integration
- `AI_INTEGRATIONS_OPENAI_API_KEY` — API key for AI calls
- `SESSION_SECRET` — Used for AES-256-GCM API key encryption + Express sessions
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (frontend)
- `CLERK_SECRET_KEY` — Clerk secret key (API server)

## Monorepo Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS v4 + shadcn/ui + Framer Motion + wouter + recharts + qrcode.react
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (CJS bundle)
