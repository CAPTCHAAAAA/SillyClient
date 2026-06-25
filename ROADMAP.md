# Tarven++ Roadmap

## v0.1 - Clean Runtime Host (current)

Demonstrate the runtime architecture end-to-end without copied SillyDroid assets.

- [x] Android project with correct package `com.tarven.plus`
- [x] Kotlin runtime architecture: Paths -> Extract -> Probe -> Start
- [x] Asset extraction from APK assets
- [x] Native library detection from nativeLibraryDir
- [x] Native binary smoke test (libtarven-node.so --version)
- [x] Server readiness probe (server.js, start-server.sh)
- [x] Diagnostic UI for self-check
- [ ] Build pipeline generates native .so and server-source.zip (separate project)

Acceptance:
- APK installs and starts
- Self-check shows all directory paths
- Reports "missing native runtime" clearly (expected until pipeline runs)
- Asset extraction works (start-server.sh is copied)

## v0.2 - Build Pipeline (TarvenBuilder)

Build-time artifact generation, NOT running on the device.

- [ ] Build Node.js for Android/Bionic (arm64-v8a)
- [ ] Build shell, git, curl for Android/Bionic
- [ ] Package SillyTavern source + node_modules into server-source.zip
- [ ] Generate dependency packs from npm install
- [ ] Produce rootfs overlay
- [ ] Copy finished .so files to jniLibs
- [ ] Copy finished .zip files to assets

Acceptance:
- APK contains libtarven-node.so, libtarven-sh.so
- APK contains server-source.zip
- v0.1 self-check passes all phases
- `libtarven-node.so --version` returns valid Node version

## v0.3 - Server Launch

Start the SillyTavern server using the native runtime.

- [ ] Verify start-server.sh works with native Node
- [ ] Configure SillyTavern for local-only mode
- [ ] Server starts and responds on 127.0.0.1:8000
- [ ] Server log captured to app private storage

Acceptance:
- Server starts within 30 seconds
- `curl http://127.0.0.1:8000/` returns HTTP 200

## v0.4 - WebView

Open the running server in an in-app WebView.

- [ ] Add WebView to layout
- [ ] Load http://127.0.0.1:8000
- [ ] Handle back navigation
- [ ] Handle server lifecycle (start on open, stop on close)

Acceptance:
- SillyTavern UI renders inside the app
- No external browser needed

## v0.5 - Manager Features

Full lifecycle management.

- [ ] Server start/stop/restart controls
- [ ] Log viewer
- [ ] Config editor
- [ ] Update mechanism
- [ ] Background service option

## Banned Approaches

These are explicitly NOT part of the roadmap:

- Termux APK wrapper / repackage
- SillyDroid generated asset copying
- First-launch `pkg install`
- On-device `git clone` or `npm install`
- Node.js Mobile
- PRoot
- Plain nodejs.org linux-arm64 Node in APK
