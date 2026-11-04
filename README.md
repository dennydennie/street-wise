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
- `pnpm db:seed` — upsert the Harare CBD camera list
- `pnpm mobile:get` / `mobile:web` / `mobile:android` / `mobile:test` / `mobile:analyze` / `mobile:build:web` / `mobile:build:apk` — Flutter commands run in `apps/mobile`

## Local infra

- `make up` — run PostgreSQL (host port 5436) and Redis (host port 6381)
- `make down` — stop local stack
- `make reset` — stop and remove local volumes
- `make logs` / `make ps`

## API at a glance

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/passkeys/*` (501, TODO) |
| Me | `GET/PATCH/DELETE /me`, `GET /me/export`, `GET /me/sessions`, `POST /me/sessions/sign-out-others`, `DELETE /me/sessions/:id`, `GET /me/passkeys`, `DELETE /me/passkeys/:id`, `GET /me/sign-in-methods`, `DELETE /me/sign-in-methods/phone` |
| Cameras | `GET /cameras?since=` (public) |
| Reports | `GET /reports?bbox=`, `POST /reports`, `PATCH/DELETE /reports/:id`, `POST /reports/:id/votes`, `POST /reports/:id/flags`, `GET/DELETE /me/reports`, `GET/POST /me/blocks`, `DELETE /me/blocks/:id` |
| Passes | `GET /passes/catalogue`, `GET /me/pass` |
| Payments | `POST /payments`, `GET /payments/:ref`, `GET /me/payments`, `POST /payments/paynow/result` (Paynow webhook) |

Locally `PAYNOW_MODE=fake`: no Paynow credentials are needed. Complete a
payment with `POST /payments/<ref>/fake-result {"outcome":"paid"}` (or open the
`redirectUrl` of a `paynow_web` payment). That goes through the same hashed
result handler as real Paynow; a pass is only ever activated there.
