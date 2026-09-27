pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "kamisado-android"

include(":engine")

// The Compose app module is fully written (see app/) but commented out here:
// building it requires the Android Gradle Plugin and Android SDK artifacts,
// which come from Google's Maven repository (dl.google.com). That host is
// unreachable from this project's original build sandbox, so wiring :app in
// makes the ENTIRE Gradle build fail to configure - including :engine:test,
// which otherwise runs and passes cleanly on its own. On a machine with
// normal internet access (or a configured Android SDK + local Google Maven
// mirror), uncomment the next line to build/run the actual app:
// include(":app")
