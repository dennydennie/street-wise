# StreetWise ZW

Voice-first road-safety app for Harare drivers: camera "robot" alerts,
community hazard reports, and Plus passes paid with EcoCash / Paynow.

See [AGENTS.md](AGENTS.md) for setup instructions and agent workflow rules.

## Layout

- `apps/api` — NestJS API (auth, users, cameras, reports, passes, payments)
- `apps/mobile` — Flutter app (Android + Flutter web)
- `packages/shared` — Shared TypeScript types, enums, rules and zod schemas

## Runtime

- Node `22.18.0` from `.nvmrc`
- pnpm `10.7.0` from `packageManager` and `engines.pnpm`
- Flutter stable (for `apps/mobile`)

## Scripts

- `pnpm install`
- `pnpm build` — build all workspace projects
- `pnpm dev` — run the API in watch mode (http://localhost:4100, Swagger UI at `/docs`)
- `pnpm lint` — lint all workspace projects
- `pnpm test` — run workspace tests
- `pnpm typecheck` — TypeScript checks
- `pnpm db:migrate` — apply TypeORM migrations
- `pnpm db:seed` — upsert the Harare CBD cameras and their areas; backfill report areas
- `pnpm db:seed:demo` — demo reporter + 90-day history around Harare CBD (idempotent, refused in production)
- `pnpm mobile:get` / `mobile:web` / `mobile:android` / `mobile:test` / `mobile:analyze` / `mobile:build:web` / `mobile:build:apk` — Flutter commands run in `apps/mobile`

## Local infra

- `make up` — run PostgreSQL (host port 5436) and Redis (host port 6381)
- `make down` — stop local stack
- `make reset` — stop and remove local volumes
- `make logs` / `make ps`

## API at a glance

| Area | Endpoints |
| --- | --- |
| Health & config | `GET /health`, `GET /config/public` (map tiles, feature flags), `GET /.well-known/assetlinks.json` |
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/passkeys/registration/{options,verify}`, `POST /auth/passkeys/authentication/{options,verify}` |
| Me | `GET/PATCH/DELETE /me`, `GET /me/export`, `GET /me/sessions`, `POST /me/sessions/sign-out-others`, `DELETE /me/sessions/:id`, `GET /me/passkeys`, `DELETE /me/passkeys/:id`, `GET /me/sign-in-methods`, `DELETE /me/sign-in-methods/phone` |
| Cameras | `GET /cameras?since=` (public) |
| Reports | `GET /reports?bbox=`, `POST /reports` (type or spoken `transcript`), `POST /reports/analyze`, `PATCH/DELETE /reports/:id`, `POST /reports/:id/votes`, `POST /reports/:id/flags`, `GET/DELETE /me/reports`, `GET/POST /me/blocks`, `DELETE /me/blocks/:id` |
| Briefings | `GET /briefings?lat&lng&radiusM&at&limit`, `GET /areas/:id?at=` (public) — see [docs/briefings.md](docs/briefings.md) |
| Transcription | `POST /transcriptions` (multipart `audio`; 503 unless `TRANSCRIPTION_PROVIDER=openai`) |
| Passes | `GET /passes/catalogue`, `GET /me/pass` |
| Payments | `POST /payments`, `GET /payments/:ref`, `GET /me/payments`, `POST /payments/paynow/result` (Paynow webhook) |

Locally `PAYNOW_MODE=fake`: no Paynow credentials are needed. Complete a
payment with `POST /payments/<ref>/fake-result {"outcome":"paid"}` (or open the
`redirectUrl` of a `paynow_web` payment). That goes through the same hashed
result handler as real Paynow; a pass is only ever activated there. With
`FAKE_PAYNOW_AUTO_SETTLE_SECONDS` set, EcoCash payments settle by themselves
through that handler (wallets ending `0000` fail with "Insufficient balance").

## Environment

`apps/api/src/config/env.schema.ts` validates everything at boot. Templates:
`.env.local.example` (local, works as-is) and `.env.example` (deployment).

| Variable | Default | Notes |
| --- | --- | --- |
| `CORS_ORIGINS` | – | Browser origins (comma list). Outside production any `http://localhost:<port>` / `127.0.0.1` is also allowed. |
| `WEBAUTHN_RP_ID` | `localhost` | Passkey relying party; must be a real domain in production. |
| `WEBAUTHN_RP_NAME` | `APP_NAME` | Shown by the passkey prompt. |
| `WEBAUTHN_ORIGINS` | `http://localhost:*` (dev) | Exact origins or `android:apk-key-hash:…`; the `:*` port wildcard is dev-only. Android origins are also derived from the fingerprints below. |
| `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINTS` | – | Build `/.well-known/assetlinks.json` (404 until set). |
| `MAPBOX_PUBLIC_TOKEN` | – | `pk.*`, sent to clients; without it `/config/public` returns OSM tiles. |
| `MAPBOX_STYLE` | `mapbox/streets-v12` | |
| `MAPBOX_SECRET_TOKEN` | – | Server-side reverse geocoding. |
| `GEOCODER` | `none` | `none` or `mapbox` (names new areas). |
| `REPORT_ANALYZER` | `rules` | `rules` or `claude` (falls back to rules). |
| `BRIEFING_WRITER` | `template` | `template` or `claude` (cached 10 min, falls back to template). |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | –, `claude-haiku-5-5` | Needed for either `claude` option. |
| `TRANSCRIPTION_PROVIDER` | `none` | `none` or `openai`. |
| `OPENAI_API_KEY`, `OPENAI_TRANSCRIBE_MODEL` | –, `gpt-4o-mini-transcribe` | |
| `OTP_DEV_ECHO` | `false` | Dev only: OTP request returns `devCode`. Refused in production. |
| `TEST_ACCOUNT_PHONE` / `TEST_ACCOUNT_CODE` | — | Tester / store-review account: that phone signs in with the fixed 6-digit code and no SMS is sent. Seeded on deploy (`pnpm db:seed:test-user`). |
| `FAKE_PAYNOW_AUTO_SETTLE_SECONDS` | `0` | Dev only, `PAYNOW_MODE=fake` only. Refused in production. |

## Deploy (Railway)

The API deploys to Railway project **street-wise** (service `api`, plus a `Postgres` database) from the
repo root using `Dockerfile` + `railway.json`. On every boot `docker-entrypoint.sh` runs migrations,
upserts the camera list, and — when `SEED_DEMO=true` — refreshes the 90-day demo history.

```bash
railway up --service api --detach      # from the repo root (project linked via `railway link`)
```

Current environment: **staging** — `https://api-production-683d8.up.railway.app` (`/health`, `/docs`).
It sends real SMS through **Gikko** and e-mail through **SendGrid** — the same provider accounts as
BluWorx (keys copied from the `bluworx` Railway project). SMS currently go out with BluWorx's
registered sender ID (`GIKKO_SENDER_NAME=BluWorx`) until a "StreetWise" sender is registered with
Gikko; e-mail is sent from `info@arcpay.cloud` (SendGrid-verified), and support/moderation mail goes
there too. Payments still use the fake Paynow gateway (`FAKE_PAYNOW_AUTO_SETTLE_SECONDS=6`, no real
money) and `OTP_DEV_ECHO` is off. Moving to `NODE_ENV=production` additionally needs Paynow live
credentials and a real passkey domain (`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS`) — the env schema
refuses to start otherwise.

Point the app at it with `--dart-define=API_BASE_URL=https://api-production-683d8.up.railway.app`.
