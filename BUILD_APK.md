# Building a real APK (optional)

The PWA at `app/` is the recommended install: open the GitHub Pages link on your
Lenovo Yoga tablet and tap **"Add to Home Screen"** — one link, app icon, offline
capable, no Play Store, no signing.

If you still want a native `.apk`, this repo ships a `buildozer.spec` for
**Buildozer** (Kivy's Python-for-Android toolchain). Buildozer must run on a PC
that has **Java JDK 17** and the **Android SDK + NDK** installed:

```bash
# on your PC (not in this sandbox)
pip install buildozer
sudo apt-get install -y openjdk-17-jdk wget  # or install Android Studio
mkdir -p $HOME/android-sdk && cd $HOME/android-sdk
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools*.zip
yes | cmdline-tools/bin/sdkmanager --sdk_root=. --licenses
cmdline-tools/bin/sdkmanager --sdk_root=. "platform-tools" "platforms;android-33" "build-tools;33.0.0" "ndk;27.0.12077973"

# clone, build, install
git clone https://github.com/<your-username>/TraderAPK.git
cd TraderAPK
export ANDROID_SDK_ROOT=$HOME/android-sdk
export ANDROID_NDK=$HOME/android-sdk/ndk/27.0.12077973
buildozer -v android debug deploy run
```

The produced APK lands in `bin/TraderAPK-1.0-arm64-v8a-debug.apk`. Transfer it to
the tablet (USB, Bluetooth, or upload to any link) and open it there. Android
will ask you to allow "Install unknown apps" for the app you transfer it through
— **there is no true one-tap APK install from a raw link**; that restriction is
Google's, not this app's. The PWA avoids all of that.

For a real-money broker connection (Zerodha Kite, Upstox, Angel One, Dhan …),
wire their API into `core/broker.py` / the paper broker in `app/app.js` and keep
**"user confirms every order"** as a hard rule. Paper trading is the default and
the safest place to start.
