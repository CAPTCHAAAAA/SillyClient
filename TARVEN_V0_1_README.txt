Tarven++ v0.1 Clean Runtime Host

Package: com.tarven.plus
See README.md for full documentation.

Quick start:
  1. Open this directory in Android Studio
  2. Wait for Gradle sync
  3. Run on device (arm64-v8a only)
  4. Tap "Run Full Self-Check"

Build pipeline artifacts (separate):
  - Native .so files -> app/src/main/jniLibs/arm64-v8a/
  - server-source.zip -> app/src/main/assets/bootstrap/server/
  - rootfs archives   -> app/src/main/assets/bootstrap/rootfs/
  - dependency packs  -> app/src/main/assets/bootstrap/server/dependency-packs/

Rules:
  - No SillyDroid copied assets
  - No Termux app wrapper
  - No on-device npm install
  - No ps1 scripts / patches / diffs
