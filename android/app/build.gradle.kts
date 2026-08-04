plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// The Xray engine is compiled only when the core artifact has been dropped in
// (scripts/fetch-vpn-core.sh). Without it the app still builds and runs, using the
// demo engine — see docs/VPN-CORE.md.
val xrayCoreAar = file("libs/libv2ray.aar")
val hasXrayCore = xrayCoreAar.exists()

android {
    namespace = "ru.delta.vpn"
    compileSdk = 35

    defaultConfig {
        applicationId = "ru.delta.vpn"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Default subscription endpoint. Point this at your own worker /sub route
        // (or leave empty and let the user paste a link in Settings).
        buildConfigField("String", "DEFAULT_SUBSCRIPTION_URL", "\"\"")
        buildConfigField("boolean", "HAS_XRAY_CORE", hasXrayCore.toString())
    }

    sourceSets {
        getByName("main") {
            if (hasXrayCore) java.srcDir("src/xray/java")
        }
    }

    signingConfigs {
        // Release signing is driven by env vars so CI can sign without secrets in git.
        val storePath = System.getenv("DELTA_KEYSTORE")
        if (!storePath.isNullOrBlank() && file(storePath).exists()) {
            create("release") {
                storeFile = file(storePath)
                storePassword = System.getenv("DELTA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("DELTA_KEY_ALIAS")
                keyPassword = System.getenv("DELTA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")
        // tun2socks ships as an executable inside jniLibs; it must stay on disk.
        jniLibs.useLegacyPackaging = true
    }
}

dependencies {
    // Drop-in VPN core artifacts (libv2ray.aar). Empty until ./scripts/fetch-vpn-core.sh
    // is run — the app falls back to the demo engine when they are absent.
    implementation(fileTree("libs") { include("*.aar", "*.jar") })

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.service)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
}
