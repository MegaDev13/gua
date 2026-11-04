plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }
android {
    namespace = "br.com.androidwebremote"
    compileSdk = 35
    defaultConfig { buildConfigField("String", "BUILD_REVISION", "\"${System.getenv("GITHUB_SHA") ?: "local"}\""); applicationId = "br.com.androidwebremote"; minSdk = 26; targetSdk = 35; versionCode = (System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1) + 100; versionName = "0.2.${System.getenv("GITHUB_RUN_NUMBER") ?: "0"}" }
    signingConfigs {
        if (System.getenv("AWR_KEYSTORE_PATH") != null) create("stable") {
            storeFile = file(System.getenv("AWR_KEYSTORE_PATH"))
            storePassword = System.getenv("AWR_STORE_PASSWORD")
            keyAlias = System.getenv("AWR_KEY_ALIAS")
            keyPassword = System.getenv("AWR_KEY_PASSWORD")
        }
    }
    buildTypes { getByName("release") { signingConfig = signingConfigs.findByName("stable"); isMinifyEnabled = false } }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
}
