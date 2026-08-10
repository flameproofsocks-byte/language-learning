# Android App

The companion Android app lives in `../language-learning-app/`. It is a standalone **React Native / Expo** project that covers Indonesian vocabulary — specifically the Word Testing and Dragon Sentence Game modes.

The web app and Android app are **separate projects** with separate `package.json` files and separate git histories. They share the same word/sentence data (copied, not symlinked) and the same game logic, re-implemented natively.

## Android App Structure

```
language-learning-app/
  App.tsx                     # Navigation root (stack: Home → WordTest / DragonGame)
  app.json                    # Expo config (name, bundle ID, icons)
  eas.json                    # EAS Build profiles (preview = APK, production = APK)
  src/
    data/
      indonesian.ts           # 100 A1 Indonesian words (same dataset as web app)
      sentences.ts            # 40 Indonesian sentence challenges
    lib/
      knowledge.ts            # AsyncStorage-backed knowledge persistence
    screens/
      HomeScreen.tsx          # Entry screen with two game buttons
      WordTestScreen.tsx      # 20-word sessions with level tracking
      DragonGameScreen.tsx    # HP-bar sentence game
```

## Building the APK

APKs are built in Expo's cloud via **EAS Build** — no Android SDK required locally.

### Prerequisites

- Node.js v18+
- An [Expo account](https://expo.dev/signup) (free)

### One-time setup

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
cd language-learning-app/
eas login

# Link the project to your Expo account
eas build:configure
```

### Build the APK

```bash
eas build --platform android --profile preview
```

- Build runs in Expo's cloud (~10–15 minutes)
- When complete, a download link is printed to the terminal
- The `.apk` file can be side-loaded onto any Android device

### Install on a device

1. Enable **Install from unknown sources** in Android Settings → Security
2. Transfer the `.apk` to the device (ADB, email, USB, etc.)
3. Tap the file to install

### Production builds

The `production` profile in `eas.json` also produces an APK. For Google Play submission you would change `buildType` to `"aab"` (Android App Bundle).

## Running in Expo Go (development)

To preview the app without building an APK:

```bash
cd language-learning-app/
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your Android device. Note: Expo Go uses a shared runtime and some native modules may behave differently from a standalone build.

## Knowledge Persistence

The Android app stores progress in **AsyncStorage** (device-local). Progress is not synced with the web app. Each game mode reads and writes to the same `knowledge_id` key.

## Differences from the Web App

| Web App | Android App |
|---|---|
| Spanish, Mandarin, Indonesian | Indonesian only |
| 5 game modes | Word Testing + Dragon Game |
| D3 knowledge graph | Not included |
| Server-side JSON storage | AsyncStorage (device-local) |
| Web Speech API mic input | Not included |
| Load Text mode | Not included |
