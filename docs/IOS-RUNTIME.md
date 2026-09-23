# iOS Runtime Startup

This is an experimental branch, not a verified iOS release.

## Build and Runtime Boundary

The workflow pins SillyTavern to commit
`06bde939fb1e9c4c8d8641d810f0a916b5bce127` and installs its lockfile with
`npm ci --omit=dev --omit=optional --ignore-scripts`.

With Node 22, `scripts/prepare-ios-frontend.mjs` runs Webpack once, without its
filesystem cache, into `dist/ios-frontend`. Compilation errors, error stats,
missing output, and compiler close errors fail the build. The manifest records
the server version, file sizes, and SHA-256 hashes.

Only after successful compilation is `native-src/prebuilt-webpack.mjs` copied
over SillyTavern's `src/middleware/webpack-serve.js`. Its existing
`runWebpackCompiler` interface now validates the manifest and every file before
the server listens. It never imports Webpack or `webpack.config.js`. GET and
HEAD requests for manifest entries use the verified directory. Other requests
continue through the normal SillyTavern middleware.

The loader does not fabricate WebAssembly. In a no-WASM runtime it uses the
already-installed `node-fetch` implementation for fetch and its related
classes, avoiding the built-in Undici HTTP parser. Tiktoken imports remain
possible, but unavailable tokenization throws `ERR_IOS_WASM_UNAVAILABLE`
instead of inventing token IDs or empty decoded text.

Detected startup errors write `server-failed.json` beside the server directory.
The native readiness poll and simulator test read this marker instead of
waiting for the entire timeout. Simulator acceptance requires HTTP 200, a
matching `lib.js` hash, and the existing webview DOM-ready marker. Diagnostics
are collected on failure and their artifact upload uses `always()`.

## Verification

Unit tests need no installed project dependencies:

```sh
node --test tests/ios-runtime.test.mjs
```

Prepare a disposable SillyTavern copy with the workflow's pinned revision and
dependencies. Do not use a personal installation: compatibility preparation
modifies dependencies and the startup loader can patch them again.

```sh
# Run preparation with Node 22 from this branch.
node native-src/patch-sillytavern.mjs /path/to/disposable/SillyTavern
ST_DISABLE_SHARP=true node scripts/prepare-ios-frontend.mjs /path/to/disposable/SillyTavern
cp native-src/ios-loader.mjs native-src/patch-sillytavern.mjs /path/to/disposable/SillyTavern/

# Switch to Node 18.20.4, matching the embedded NodeMobile version.
SILLYCLIENT_IOS_SERVER=/path/to/disposable/SillyTavern \
  node --test tests/ios-runtime.test.mjs tests/ios-server.test.mjs
```

`SILLYCLIENT_TEST_TMP` sets the temporary directory parent.
`SILLYCLIENT_TEST_LOG` optionally preserves the full server subprocess log.
The integration test uses fresh synthetic user data and an ephemeral loopback
port. It disables WASM, blocks runtime Webpack imports, checks outbound fetch
against the local server, and verifies homepage and asset responses. It kills
its child and removes synthetic data afterward. Run it serially for any one
prepared server copy.

The host integration test intentionally uses Node 18.20.4. Desktop Node
22.16.0 eagerly initializes Undici through ESM `node:http` exports under
`--jitless`, so it is not an equivalent substitute for this runtime test.
The workflow restores Node 22 before running Capacitor tools.

## Remaining Limits

- A Windows host startup test does not validate NodeMobile's small-ICU build,
  Swift compilation, iOS signing, simulator behavior, or physical devices.
- No-WASM tokenization, image codecs, and model inference are not made
  functional by this startup repair. Their feature-level behavior still needs
  separate validation.
- SillyTavern declares Node >=20; the embedded runtime remains 18.20.4.
  A successful smoke test does not establish full upstream compatibility.
- Existing sandbox server installations are reused by the native runner.
  This change does not implement migration or repair of older copied runtimes.
- No frontend visual changes, release, or main-branch integration are part of
  this repair.
