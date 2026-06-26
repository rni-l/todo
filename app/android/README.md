# TODO Android

Kotlin + Jetpack Compose Android client for the self-hosted TODO server in this repository.

## Scope

The v1 Android app is a native client, not a WebView wrapper. It covers daily use:

- Configure server URL and log in with the existing self-hosted account
- Today, Inbox, Calendar, Projects, and More tabs
- Create, edit, complete, close, and delete tasks
- Edit dates, priority, urgent flag, project, tags, description, and subtasks
- Month calendar with selected-day task list, range-task dots, and contextual create defaults
- Read-only offline cache
- Local Android reminder notifications from `reminderAt`

The server remains the source of truth. Offline writes are intentionally blocked.

## Build

Use Android Studio's bundled JBR 17 when building from shell:

```bash
cd app/android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:assembleDebug
```

Run unit tests:

```bash
cd app/android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:testDebugUnitTest
```

The local `gradlew` script bootstraps Gradle 8.13 into `app/android/.gradle/bootstrap` if no system Gradle is installed.

## Local Server Smoke

Start the existing Node app from the repository root:

```bash
PORT=38887 npm run dev
```

On the Android device or emulator, use a reachable server URL:

- Physical phone on same LAN: `http://<your-mac-lan-ip>:38887`
- Android emulator: `http://10.0.2.2:38887`

Default local bootstrap credentials remain:

```text
Username: self-hosted-user
Password: todo123456
```

For real use, change the password in the Web app or start the server with `TODO_PASSWORD` before first data creation.
