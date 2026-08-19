# OpenFront Discord Bot

A production-ready Discord bot for [OpenFront](https://openfront.io/) that queries the **official OpenFront public API** and presents games, players and clans in clean, paginated Discord embeds.

Only the official API is used — no unofficial endpoints, scraping or arbitrary URL fetching.
Note: **some** code was gen by ai, with human review.
## Table of contents

1. [Project description](#1-project-description)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [Environment variables](#4-environment-variables)
5. [Discord application setup](#5-discord-application-setup)
6. [Bot permissions](#6-bot-permissions)
7. [Command registration](#7-command-registration)
8. [Running the bot](#8-running-the-bot)
9. [Development instructions](#9-development-instructions)
10. [Production deployment](#10-production-deployment)
11. [API rate-limit considerations](#11-api-rate-limit-considerations)
12. [Project structure](#12-project-structure)

---

## 1. Project description

The bot implements eight slash commands that surface OpenFront data in Discord embeds:

| Command | Description |
| --- | --- |
| `/game <game_id>` | Detailed info about a single game (map, type, mode, difficulty, players, team config, ranked type, timings, duration, winner, settings, player list). |
| `/games` | Search recent games with time-range, type, mode, ranked-type, team-config and limit filters. Paginated with buttons. |
| `/player <player_id>` | Player profile: account creation, clans, and aggregated W/L stats by game type. |
| `/player-games <player_id>` | Player game history with FFA/team/HVN/ranked and public/private/singleplayer filters. Uses the API `nextCursor` for pagination. |
| `/player-sessions <player_id>` | The player's sessions list. |
| `/clan <clan_tag>` | Clan statistics over the last 24 hours: games, wins, losses, win rate, W/L ratio, weighted stats and team-type / team-count breakdowns. |
| `/clan-sessions <clan_tag>` | Recent clan sessions (last 24 hours), page-paginated. |
| `/clan-leaderboard` | Top clans by weighted wins, paginated 10 per page. |

All embeds use consistent colors, timestamps and emojis. Pagination is driven by Discord buttons that only the originating user can operate. Errors are surfaced as friendly ephemeral embeds — never stack traces.

### Architecture highlights

- **Reusable API client** (`src/openfront/client.ts`) with the request flow:
  `Validate → Cache lookup → Request deduplication → Rate limiter → API request → Cache response → Return`
- **Cache hits never consume rate-limit tokens** and never hit the network.
- **Concurrent request deduplication** — simultaneous identical requests share a single API call.
- **Per-endpoint token-bucket rate limiting** with configurable base rate and per-endpoint overrides.
- **Exponential backoff with jitter** for HTTP 429 (honoring `Retry-After`) and transient 5xx/network failures. Non-retryable 4xx errors are never retried.
- **In-memory TTL cache** with per-endpoint expiration.
- **`GET /health`** HTTP endpoint for uptime checks.
- Typed API models, embedded response fixtures, and a full Vitest suite with mocked `fetch`.

## 2. Requirements

- Node.js **20+** (developed and tested on **22.x**)
- `pnpm` (v9+; the project uses pnpm 11 conventions)
- A [Discord application](https://discord.com/developers/applications) with a bot token
- Internet access to `https://api.openfront.io/public` (the official OpenFront API)

## 3. Installation

```bash
git clone <your-repo-url>
cd openfront.io-discord-bot
pnpm install
cp .env.example .env   # then edit .env with your token
```

## 4. Environment variables

All configuration is read from the environment (`.env` is supported via `dotenv`). See [`.env.example`](./.env.example) for the complete list with defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | *(required)* | The Discord bot token. Never commit this. |
| `DISCORD_CLIENT_ID` | *(required)* | Your Discord application's client ID. |
| `GUILD_ID` | *(empty)* | Register commands to a single guild for instant updates during development. Empty = global registration. |
| `API_BASE_URL` | `https://api.openfront.io/public` | Official OpenFront public API base URL. |
| `API_TIMEOUT_MS` | `15000` | Per-request timeout in milliseconds. |
| `API_MAX_RETRIES` | `4` | Max retries for retryable failures (429/5xx/network). |
| `CACHE_TTL_GAMES_MS` | `300000` | TTL for `/games` listings. |
| `CACHE_TTL_GAME_DETAIL_MS` | `600000` | TTL for `/game/:id` details. |
| `CACHE_TTL_PLAYER_MS` | `900000` | TTL for player profiles. |
| `CACHE_TTL_PLAYER_GAMES_MS` | `300000` | TTL for player game history and sessions. |
| `CACHE_TTL_CLAN_MS` | `300000` | TTL for clan stats. |
| `CACHE_TTL_CLAN_SESSIONS_MS` | `300000` | TTL for clan sessions. |
| `CACHE_TTL_LEADERBOARD_MS` | `600000` | TTL for the clan leaderboard. |
| `RATE_LIMIT_RPS` | `2` | Base requests/second for the token bucket. |
| `RATE_LIMIT_BURST` | `5` | Base burst (bucket capacity) per endpoint bucket. |
| `PORT` | `3000` | Port for the `GET /health` HTTP server. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. |

The bot **fails fast at startup** if `DISCORD_TOKEN` or `DISCORD_CLIENT_ID` are missing. Secrets are never logged.

## 5. Discord application setup

1. Go to https://discord.com/developers/applications and create a new application.
2. Under **Bot**, click **Reset Token** and copy the token into `DISCORD_TOKEN`.
3. Copy the **Application ID** (top of the General Information page) into `DISCORD_CLIENT_ID`.
4. Under **Bot → Privileged Gateway Intents**, enable the intents your server needs. This bot only requires **Server Members / Message Content is not required** — the default set is sufficient since it uses slash commands only (gateway intent `Guilds`).
5. Invite the bot to your server using the OAuth2 **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: see below.

## 6. Bot permissions

The bot needs the following permissions (or "Send Messages" for the channel it operates in, plus "Use Slash Commands" which is implied by slash commands):

- **Send Messages**
- **Embed Links**
- **Use Slash Commands**
- **Use External Emojis** (optional, only if you customize embeds with custom emojis)

The minimum recommended invite permission integer is **22528** (`Send Messages` + `Embed Links` + `Use Slash Commands`), which Discord computes automatically when you tick those boxes in the URL generator.

## 7. Command registration

Commands are registered automatically when the bot starts, **and** can be deployed manually:

```bash
pnpm register          # global registration (can take up to ~1 hour to propagate)
GUILD_ID=123 pnpm register   # instant per-guild registration for development
```

`pnpm register` uses `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and optional `GUILD_ID` from `.env` / the environment. Set `GUILD_ID` for instant updates while developing, then leave it empty for the final global deployment.

## 8. Running the bot

```bash
pnpm build      # compile TypeScript to dist/
pnpm start      # node dist/index.js
```

Or run directly in development:

```bash
pnpm dev        # tsx watch src/index.ts
```

On startup the bot logs in, deploys commands, and starts the health server on `PORT`.

## 9. Development instructions

```bash
pnpm install

# typecheck
pnpm tsc --noEmit

# lint (eslint, zero warnings allowed)
pnpm lint

# tests (Vitest, all API calls mocked)
pnpm test

# watch mode
pnpm test:watch

# live smoke test against the real API (uses mock tokens; just exercises the API client)
DISCORD_TOKEN=dummy DISCORD_CLIENT_ID=dummy pnpm exec tsx scripts/smoke.ts
```

### Test data

`test/fixtures/` contains **captured real API responses** for every documented endpoint (`game-detail.json`, `games-list.json`, `player.json`, `player-games.json`, `player-sessions.json`, `clan.json`, `clan-sessions.json`, `clans-leaderboard.json`). Tests never hit the network — they inject a mocked `fetch`.

Coverage includes: client URL/query construction, response parsing, malformed responses, HTTP error mapping (404/400/429/5xx/network/timeout), retries with backoff and `Retry-After`, rate-limit token buckets, TTL cache expiry, **concurrent request deduplication**, **cache-before-rate-limit**, pagination boundaries, input validation and embed formatting.

## 10. Production deployment

### Docker

```bash
docker compose up -d --build
```

The included [`Dockerfile`](./Dockerfile) builds a small `node:22-alpine` image. Set `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and other variables via environment (or `.env` with docker compose). The container exposes the health port.

### Manual

- Run `pnpm install --frozen-lockfile && pnpm build` in the image/CI.
- Start `node dist/index.js` under a process manager (e.g. `pm2`, systemd, or Kubernetes).
- Point your uptime monitor at `http://<host>:<port>/health` — it returns `{"status":"ok", ...}`.
- Use a reverse proxy or internal network; the health endpoint is intentionally minimal.

## 11. API rate-limit considerations

The OpenFront API has **very strict rate limits**. This bot is built to be a good citizen:

1. **Caching** — every endpoint is cached in memory with a sensible TTL. Repeated identical lookups (e.g. the same `/game` embed in multiple channels) hit the cache and never touch the API.
2. **Request deduplication** — simultaneous identical requests coalesce into a single upstream call.
3. **Throttling** — a token-bucket rate limiter runs per endpoint bucket (`games`, `gameDetail`, `player`, `playerGames`, `playerSessions`, `clan`, `clanSessions`, `leaderboard`). Base `RATE_LIMIT_RPS`/`RATE_LIMIT_BURST` apply globally; individual buckets can be tuned in `src/openfront/index.ts`.
4. **Backoff** — HTTP 429 (respecting `Retry-After` when present) and transient 5xx/network failures are retried with exponential backoff plus jitter, up to `API_MAX_RETRIES`.
5. **No retry on client errors** — 4xx validation/not-found errors are never retried.
6. **Avoidance** — clan commands use a fixed trailing-24h window (the live API caps clan time ranges at 1 day), and `/games` fetches at most the user's requested limit (capped at 60) in a single request.
7. **Graceful degradation** — exhausted retries produce a friendly "please try again" message rather than spamming the API.

Defaults are intentionally conservative. If your bot needs more throughput, adjust `RATE_LIMIT_RPS`/`RATE_LIMIT_BURST` (and per-bucket overrides) — and consider raising cache TTLs before raising rate limits.

## 12. Project structure

```
.
├── src/
│   ├── index.ts                 # entrypoint: login, command deploy, interaction routing, health server
│   ├── register-commands.ts     # standalone slash-command registration script
│   ├── config.ts                # env parsing + validation
│   ├── logger.ts                # minimal leveled logger (never logs secrets)
│   ├── health.ts                # GET /health HTTP server
│   ├── models/
│   │   └── types.ts             # API response types (grounded in real fixtures)
│   ├── openfront/
│   │   ├── client.ts            # OpenFront API client (request flow, retries, backoff)
│   │   ├── cache.ts             # in-memory TTL cache
│   │   ├── deduplicator.ts      # concurrent request deduplication
│   │   ├── rateLimiter.ts       # per-endpoint token bucket
│   │   ├── errors.ts            # typed OpenFront errors
│   │   ├── parsers.ts           # Content-Range + JSON response parsing
│   │   ├── validation.ts        # conservative input validation
│   │   └── index.ts             # wires cache + rate limiter + client from config
│   └── discord/
│       ├── commands.ts          # slash command definitions
│       ├── router.ts            # command-name → handler routing
│       ├── pagination.ts        # embed + button pagination (static/cursor) + registry
│       ├── errors.ts            # error → user-friendly embed mapping
│       ├── embeds/
│       │   ├── formatting.ts    # colors, duration/number/timestamp helpers
│       │   ├── game.ts          # game detail + game list embeds
│       │   ├── player.ts        # player, player-games, player-sessions embeds
│       │   └── clan.ts          # clan, clan-sessions, leaderboard embeds
│       ├── deploy.ts            # Discord REST command deployment
│       └── handlers/
│           ├── types.ts         # shared handler context + last-24h window helper
│           ├── game.ts
│           ├── games.ts
│           ├── player.ts
│           ├── player-games.ts
│           ├── player-sessions.ts
│           ├── clan.ts
│           ├── clan-sessions.ts
│           └── clan-leaderboard.ts
├── test/
│   ├── helpers.ts               # fixture loader + mocked-fetch client factory
│   ├── fixtures/                # captured real API responses (used by tests)
│   └── *.test.ts                # unit tests (Vitest)
├── scripts/
│   └── smoke.ts                 # optional live API smoke test
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml          # pnpm 11 settings (allowBuilds: esbuild)
├── tsconfig.json
├── eslint.config.js
└── vitest.config.ts
```

## Security notes

- The bot token lives only in the environment / `.env` and is never logged.
- All user-provided IDs are conservatively validated before any network request; the OpenFront API is the final authority.
- The client only ever talks to `API_BASE_URL` (the official OpenFront public API). No user-supplied URLs are requested.