plugins {
    id("org.jetbrains.kotlin.jvm") version "2.0.21" apply false

    // Needed only once app/ is wired into settings.gradle.kts (see the
    // comment there): this declaration alone forces Gradle to resolve the
    // Android Gradle Plugin from Google's Maven repo for ANY task in this
    // build, even :engine:test, so it stays commented out in the sandbox
    // this project was originally built in.
    // id("com.android.application") version "8.7.2" apply false
    // id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
