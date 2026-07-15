# Task Bridge Mobile

Android client (Kotlin + Compose).

## APK build

Android Studio veya komut satırından Gradle ile:

```bash
cd apps/mobile
./gradlew :app:assembleDebug
```

Output: `apps/mobile/app/build/outputs/apk/debug/app-debug.apk`

JDK 17+ ve Android SDK gerekir.

## Android Studio

Open `apps/mobile`, run on device or emulator.

Emulator default backend: `10.0.2.2:3000`

## Auth

- Scan the QR from the web **Mobile** page to pair. The QR carries the server URL and a session token, so scanning signs you in directly.
- Or set the server manually in **Settings → Manual setup**, then sign in with your email and password (`POST /api/auth/login`).
- All API calls use `Authorization: Bearer <token>`. Use **Log out** in Settings to clear the session.

## Epics & tasks

Home toolbar → **Epics** (list icon):

- Epic list via `/inbox?epicsOnly=true`
- Epic detail via `/tasks/{id}` with workflow stages and subtasks
- Add one task from epic detail: pick a stage or parent subtask (`POST /tasks`)
- Task detail with title, description, status, comments
- Description and comments can be read aloud (TTS uses device locale, English fallback)
- Comments read and write on epics and tasks
- No workflow canvas
