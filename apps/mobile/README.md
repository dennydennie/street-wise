# StreetWise ZW — mobile (Flutter)

Voice-first road-safety aid for Harare drivers: camera-robot alerts, hands-free hazard reports,
and Plus passes paid with EcoCash / Paynow. Targets **Android** (primary) and **Flutter web**.

Implements the 30 screens from the Claude Design file `StreetWise ZW App.dc.html`
(Industry design system: steel accent on paper, Barlow Condensed over Barlow, blueprint frames).

## Run

```bash
flutter pub get
flutter run -d chrome        # Flutter web
flutter run -d <android-id>  # Android device / emulator
flutter analyze && flutter test
```

## Layout

```
lib/
  main.dart                     app entry, theme, first route
  app/shell.dart                tabs (Drive · Map · Activity · Account) + tour host
  core/theme/tokens.dart        design tokens (colours, type) from the Industry DS
  core/widgets/                 Blueprint frame, buttons, rows, tags, switches, wordmark
  data/app_state.dart           app state (ChangeNotifier) + mock account data
  data/map_data.dart            Harare CBD sample cameras & reports
  features/
    auth/          09 Welcome · 10 Passkey sheet · 11 OTP · 12 Create passkey
    onboarding/    01 Onboarding (voice-first, location disclosure, battery)
    home/          02 Home
    drive/         03 Drive mode · 04 Camera alert · 05 Still there? · 06 Report
    map/           07 Map · 16 Report detail / flag & block
    activity/      17 Activity · my reports
    account/       13 Account · 08 Alerts & voice · 14 Sign-in · 15 Privacy · 18 Help
                   19 Delete account · 20 Account deleted · blocked reporters
    plus/          21 Pick a pass · 22 Checkout · 23 EcoCash wait · 24 Success
                   25 Failed · 26 Subscription
    tour/          27–30 spotlight walkthrough
    legal/         Terms, Community rules, Privacy, FAQ, battery guide, licences
```

## What is simulated (prototype seams)

- **Data**: `AppState` holds mock data; nothing is persisted or sent to `apps/api` yet.
- **Drive**: the trip, speed and alert timing are simulated (time compressed ×4). Production needs
  a foreground service, GPS, and text-to-speech.
- **Auth**: the passkey sheet stands in for Android Credential Manager; the OTP auto-fills after 5 s
  (SMS Retriever stand-in).
- **Payments**: EcoCash approves after two 5-second polls. Numbers ending `0000` simulate
  "insufficient balance". The Paynow web checkout is a bottom sheet.
- **Map**: drawn placeholder; swap in `flutter_map` + OSM tiles.

Fonts (Barlow, Barlow Condensed — SIL OFL) are bundled in `assets/fonts/`.
