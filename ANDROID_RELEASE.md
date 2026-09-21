# Building a Release-Signed Android APK/AAB

The web app ships via GitHub Pages, and the `android/` folder wraps the same
dist as a native Android app through Capacitor 8. This guide covers producing a
**release-signed** APK (not a Debug APK) so the app is installable on real
devices and can be published to stores.

## Prerequisites

- Node 22 + npm (the project is npm-only).
- Android SDK with the Gradle wrapper invoked successfully once
  (`./gradlew --version` inside `android/`).
- A release keystore. The repo **never** contains a keystore or its passwords.

## The keystore

Generate it once and keep it safe (do not commit it, back it up):

```bash
keytool -genkey -v -keystore quranapp-release.jks -alias quranapp \
  -keyalg RSA -keysize 2048 -validity 10000
```

## Signing configuration

`android/app/build.gradle` already reads the signing material from environment
variables (never committed):

| Variable               | Meaning                     |
|------------------------|-----------------------------|
| `QURANAPP_KEYSTORE`    | absolute path to the `.jks` |
| `QURANAPP_STORE_PASS`  | keystore password           |
| `QURANAPP_KEY_ALIAS`   | key alias (e.g. `quranapp`) |
| `QURANAPP_KEY_PASS`    | key password                |

Without them the Gradle release build stays unsigned (debug-style) — the script
below refuses to silently produce an unsigned "release".

## Build it (any OS)

PowerShell:

```powershell
$env:QURANAPP_KEYSTORE = "C:\keys\quranapp-release.jks"
$env:QURANAPP_STORE_PASS = "..."
$env:QURANAPP_KEY_ALIAS = "quranapp"
$env:QURANAPP_KEY_PASS = "..."
npm run android:release
```

bash:

```bash
export QURANAPP_KEYSTORE=/path/quranapp-release.jks QURANAPP_STORE_PASS=... \
  QURANAPP_KEY_ALIAS=quranapp QURANAPP_KEY_PASS=...
npm run android:release
```

`npm run android:release` runs `scripts/build-release.mjs`, which sets
`BUILD_TARGET=capacitor` portably, builds the web app, syncs Capacitor, and
runs `gradlew assembleRelease bundleRelease`. Artifacts:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Running it without the environment variables prints this guidance and exits 0
(no harm on a dev machine); add `--ci` to make it exit 1 instead.

## CI (GitHub Actions)

`.github/workflows/android-release.yml` (manual `workflow_dispatch`) rebuilds
the signed release in CI and uploads both artifacts. Repository secrets:

| Secret                     | Value                              |
|----------------------------|------------------------------------|
| `QURANAPP_KEYSTORE_B64`    | `base64 quranapp-release.jks`      |
| `QURANAPP_STORE_PASS`      | keystore password                  |
| `QURANAPP_KEY_ALIAS`       | key alias                          |
| `QURANAPP_KEY_PASS`        | key password                       |

Heads-up on Windows local builds: `npm run android:build` uses a bash-only env
prefix and therefore does not run under cmd/PowerShell; use
`npm run android:release` (or set `BUILD_TARGET=capacitor` yourself) instead.