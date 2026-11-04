# StreetWise ZW — mobile (Flutter)

Voice-first road-safety aid for Harare drivers: camera-robot alerts, hands-free hazard reports,
time-aware area briefings, and Plus passes paid with EcoCash / Paynow. Targets **Android**
(primary) and **Flutter web**. Talks to `apps/api` for everything.

## Run against the local API

```bash
# from the repo root: database + API (see root README)
make up && pnpm db:migrate && pnpm db:seed && pnpm db:seed:demo
pnpm -F @streetwise/api start:dev

# then the app
cd apps/mobile
cp config/dart_defines.example.json config/dart_defines.json   # edit if needed
flutter run -d chrome --dart-define-from-file=config/dart_defines.json
flutter run -d <android-id> --dart-define-from-file=config/dart_defines.json
flutter analyze && flutter test
```

### Build-time config (`--dart-define`)

| Key | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://localhost:4100` (web/iOS), `http://10.0.2.2:4100` (Android emulator) | API origin. Use your machine's LAN IP for a real phone. |
| `MAPBOX_PUBLIC_TOKEN` | — | Optional override. Normally the API's `/config/public` supplies the tile URL (from `MAPBOX_PUBLIC_TOKEN` on the server); with neither, the map uses OpenStreetMap tiles. |
| `MAPBOX_STYLE` | `mapbox/streets-v12` | Style used with the override token. |

Android allows plain HTTP only to `10.0.2.2`, `localhost` and `127.0.0.1`
(`android/app/src/main/res/xml/network_security_config.xml`); everything else must be HTTPS.

## How the pieces connect

| Feature | App | API |
|---|---|---|
| Sign-in | Passkey (OS sheet via `passkeys`), or phone OTP | `/auth/passkeys/*`, `/auth/otp/*` |
| Profile & rules | Create passkey · agree screen | `PATCH /me` (`displayName`, `agreedToRulesAt`) |
| Camera alerts | Cached camera list, GPS distance + heading, spoken via TTS | `GET /cameras` |
| Area briefings | Home "Fresh on your routes", Map (Now / Tonight), drive-mode banners | `GET /briefings`, `GET /areas/:id` |
| Voice reports | On-device speech-to-text → `/reports/analyze` preview → post with transcript | `POST /reports/analyze`, `POST /reports` |
| Still there? | After passing a live report: spoken prompt + yes/no listening | `GET /reports?bbox`, `POST /reports/:id/votes` |
| Flag / block | Area briefing → recent reports | `POST /reports/:id/flags`, `/me/blocks` |
| Activity | Posted reports, draft pins, offline pins | `/me/reports`, `PATCH`/`DELETE /reports/:id` |
| Plus | Catalogue, EcoCash prompt / Paynow web checkout, polling | `/passes/catalogue`, `/payments`, `/me/pass` |
| Privacy | Export, erase reports, sessions, delete account | `/me/export`, `DELETE /me/reports`, `/me/sessions`, `DELETE /me` |

**Briefings are time-aware**: the API scores each area by what is relevant *now* (Africa/Harare
time bands). Night-time crime at an intersection doesn't alert a midday driver, but leads the
briefing for a 22:00 driver. Drive mode speaks an area's headline and advice when you are within
~600 m and heading towards it. See `docs/briefings.md` at the repo root.

**Offline & anonymous**: listening needs no account. Pins dropped without an account or connection
are kept on the phone and posted as drafts after sign-in. The camera list is cached.

## Layout

```
lib/
  main.dart                     entry; AppState + device services
  app/shell.dart                tabs (Drive · Map · Activity · Account) + tour host
  core/config/env.dart          dart-define config
  core/api/api_client.dart      JSON client: bearer auth, timeouts, ApiException
  core/storage/local_store.dart token (secure storage), settings, offline pins
  core/services/                location (geolocator), voice (speech_to_text + flutter_tts), passkeys
  core/theme, core/widgets      Industry design system
  data/models.dart              typed API contracts
  data/api/streetwise_api.dart  one method per endpoint
  data/app_state.dart           app state (ChangeNotifier) backed by the API
  features/                     auth · onboarding · home · drive · map · activity · account · plus · tour · legal
```

## Known limits

- **Passkeys on Android** need the API's `/.well-known/assetlinks.json` served from the RP domain
  (`WEBAUTHN_RP_ID`) with this app's signing-cert SHA-256. On Flutter web, `localhost` works as RP ID.
- **Drive mode** uses the foreground GPS stream; a background foreground-service (screen off) is
  not wired yet. Without GPS (web/desktop) it drives a demo route along Samora Machel Ave.
- **Shona/Ndebele speech** depends on the device recognizer; the server analyser understands
  common Shona/Ndebele hazard words either way.
