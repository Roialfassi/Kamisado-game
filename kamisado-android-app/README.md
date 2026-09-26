# Kamisado Android App - Build & Verification Status

This directory has two Gradle modules with **very different verification status**:

## `engine/` - fully verified

A pure Kotlin/JVM port of the TypeScript rules engine (`packages/engine` at the repo
root), with a JUnit port of all 25 cases from `../docs/TEST_SUITE_AND_EDGE_CASES.md`.

```
./gradlew :engine:test
```

This genuinely runs in any environment with a JDK and normal Maven Central access -
no Android SDK required. It has been run in the environment this project was built
in, and all 25 tests pass.

## `app/` - written, but NOT build-verified

A Jetpack Compose UI (touch board, tap-to-select move input, haptic feedback for
piece placement and Sumo pushes, a Tabletop-mode 180-degree flip toggle, and a
lightweight two-tier on-device AI opponent) covering roughly the Phase 1-2 scope
from `PLAN.md`. It has **not** been compiled or run, because building any Android
module requires the Android Gradle Plugin and Android SDK artifacts, which are
resolved from Google's Maven repository (`dl.google.com`) - a host that was
unreachable from this project's original build sandbox (network egress policy
blocked it; everything else, including Maven Central, worked fine).

Because of that, `settings.gradle.kts` does **not** include `:app` by default, so
that `:engine:test` keeps working out of the box in a constrained environment.
To build the real app on a machine with normal internet access and an installed
Android SDK:

1. Uncomment `include(":app")` in `settings.gradle.kts`.
2. Uncomment the `com.android.application` / `org.jetbrains.kotlin.android` plugin
   lines in the root `build.gradle.kts`.
3. Run `./gradlew :app:assembleDebug` (or open the project in Android Studio, which
   does both of the above for you once you accept the SDK license prompts).

The code has been carefully hand-reviewed for correctness (and one real bug - a
`Color` type collision between the engine's own color enum and
`androidx.compose.ui.graphics.Color` - was caught and fixed during that review),
but treat it as **unverified** until it has actually been compiled once on a
machine with SDK access. Not built at all: the Dragon's Ascent campaign, daily
puzzles, Bluetooth/Wi-Fi Direct play, Google Play Games auth, push notifications,
and the Dragon Vault cosmetic system from `PLAN.md` - those remain on the roadmap.
