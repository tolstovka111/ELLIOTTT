# The Xray core is reached through reflection, so its Go-generated bindings must
# survive shrinking even though nothing references them at compile time.
-keep class libv2ray.** { *; }
-keep class go.** { *; }
-keep interface libv2ray.** { *; }

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class ru.delta.vpn.** {
    *** Companion;
}
-keepclasseswithmembers class ru.delta.vpn.** {
    kotlinx.serialization.KSerializer serializer(...);
}
