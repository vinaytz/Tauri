# Tauri + Vanilla

This template should help get you started developing with Tauri in vanilla HTML, CSS and Javascript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Running on Android

### Prerequisites

#### 1. Install Android Studio

Download and install [Android Studio](https://developer.android.com/studio). During setup, make sure these are installed:

- **Android SDK** (API level 33 or higher)
- **Android SDK Platform-Tools**
- **Android NDK** (side by side) — version **25.x** or **26.x**
- **Android SDK Build-Tools**
- **Android SDK Command-line Tools**

#### 2. Set Environment Variables

Open PowerShell and add these to your system environment (adjust paths if needed):

```powershell
# Set JAVA_HOME (Android Studio bundles a JDK)
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")

# Set ANDROID_HOME
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

# Set NDK_HOME (check the actual version folder under ndk/)
[System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LOCALAPPDATA\Android\Sdk\ndk\26.1.10909125", "User")
```

> **Restart your terminal** after setting these.

#### 3. Install Rust Android Targets

```powershell
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### Initialize Android for the Project

```powershell
cd my-tauri-app
npx tauri android init
```

This creates the `src-tauri/gen/android` folder with the Android project.

### Run on Android

#### Option A: USB-connected physical device

1. Enable **Developer Options** and **USB Debugging** on your phone
2. Connect via USB and confirm the debugging prompt on your phone
3. Run:

```powershell
npx tauri android dev
```

#### Option B: Android Emulator

1. Open Android Studio → **Virtual Device Manager** → create an emulator
2. Start the emulator
3. Run:

```powershell
npx tauri android dev
```

### Build an APK

```powershell
npx tauri android build
```

The APK will be generated under `src-tauri/gen/android/app/build/outputs/apk/`.

### Quick Reference

| Step | Command |
|---|---|
| Add Rust targets | `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android` |
| Init Android project | `npx tauri android init` |
| Run on device/emulator | `npx tauri android dev` |
| Build APK | `npx tauri android build` |

> The most common issue is incorrect `JAVA_HOME`, `ANDROID_HOME`, or `NDK_HOME` paths. Double-check those match your actual install locations if you hit errors.
