# Tarven++

One-click SillyTavern launcher for Android. No Termux, no command lines — install the APK, open the app, and your tavern is ready.

## How it works

1. Install the APK (~50 MB)
2. Open Tarven++
3. First launch downloads SillyTavern (~130 MB, one-time)
4. Tavern starts automatically, WebView loads `http://127.0.0.1:8000`

## Architecture

```
APK assets (bundled)
├── jniLibs/arm64-v8a/
│   ├── libtarven-node.so    # Node.js v24 Bionic runtime
│   └── libc++_shared.so
├── bootstrap/rootfs/
│   └── rootfs-libs.zip      # Runtime shared libraries
└── bootstrap/scripts/
    └── start-server.sh      # Server launcher

First launch (downloaded)
└── server-source.zip        # SillyTavern + node_modules
    └── → files/tarven/bootstrap/server/
```

## Build

```bash
# Clone
https://github.com/YOUR_USER/TarvenPlus.git
cd TarvenPlus

# Build APK
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Pre-built server source

The `server-source.zip` is built separately and hosted on GitHub Releases.

```bash
# Build server-source.zip (requires Node.js + npm)
bash scripts/build-server-source.sh
```

## Requirements

- Android 8.0+ (API 26)
- arm64-v8a device
- ~200 MB free storage (runtime + tavern)
- Internet connection for first launch

## License

MIT