[app]

# Title of your application
title = TraderAPK
# Package name
package.name = traderapk
# Package domain (needed for Android)
package.domain = org.yashasvamoond
# Source directory where the main.py lives
source.dirs = app, core
# Source files to include (let buildozer find main entry)
source.include_exts = py,png,json,html,js,css,svg
# Application version
version = 1.0
# Application requirements (Kivy webview wrapper)
requirements = python3,kivy,buildozer,yfinance
# Supported orientation
orientation = portrait

[buildozer]

# Log level
log_level = 2
# Warn on root user
warn_root = 1

[android]

# Android archs
archs = arm64-v8a
# Android SDK version
android.api = 33
# Android NDK version
android.ndk = 27.0.12077973
# Minimum Android version
android.minapi = 21
# Android SDK path
android.sdk = 20
# Python-for-android checkout
p4a.branch = master

# Permissions
android.permissions = INTERNET, ACCESS_NETWORK_STATE

# Java keystore (sign for release)
android.keystore = debug

[android.fullscreen]

[buildozer]
