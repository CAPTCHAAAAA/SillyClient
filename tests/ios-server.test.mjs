import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';

const directory = process.env.SILLYCLIENT_IOS_SERVER;

test('the prepared server starts without WASM and serves verified frontend assets', {
    skip: directory ? false : 'Set SILLYCLIENT_IOS_SERVER to a disposable, prepared SillyTavern copy.',
    timeout: 60000,
}, async t => {
    const server = fs.realpathSync(directory);
    const parent = process.env.SILLYCLIENT_TEST_TMP || os.tmpdir();
    fs.mkdirSync(parent, { recursive: true });
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(parent, 'ios-server-')));
    t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));

    const listener = net.createServer();
    listener.listen(0, '127.0.0.1');
    await once(listener, 'listening');
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));

    const require = createRequire(path.join(server, 'package.json'));
    const yaml = require('yaml');
    const config = yaml.parse(fs.readFileSync(path.join(server, 'default', 'config.yaml'), 'utf8'));
    config.dataRoot = path.join(temporary, 'data');
    config.browserLaunch.enabled = false;
    config.extensions.autoUpdate = false;
    config.extensions.models.autoDownload = false;
    const configPath = path.join(temporary, 'config.yaml');
    fs.writeFileSync(configPath, yaml.stringify(config));
    const guard = path.join(temporary, 'guard.cjs');
    fs.writeFileSync(guard, `
        const assert = require('node:assert/strict');
        assert.equal(typeof WebAssembly, 'undefined');
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function(request, ...args) {
            if (request === 'webpack' || /(?:^|[/\\\\])webpack[/\\\\]/.test(request)) {
                throw new Error('Runtime must not import webpack: ' + request);
            }
            return load.call(this, request, ...args);
        };
        console.log('[test] WASM disabled; webpack imports blocked.');
    `);
    const fetchVerified = path.join(temporary, 'fetch-verified.txt');
    const entry = path.join(temporary, 'entry.mjs');
    fs.writeFileSync(entry, `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        import { serverEvents, EVENT_NAMES } from ${JSON.stringify(pathToFileURL(path.join(server, 'src', 'server-events.js')).href)};
        serverEvents.once(EVENT_NAMES.SERVER_STARTED, async ({ url }) => {
            const response = await fetch(new Request(url));
            assert.equal(response.status, 200);
            assert.ok(response instanceof Response);
            assert.ok(response.headers instanceof Headers);
            assert.match(await response.text(), /SillyTavern/);
            fs.writeFileSync(${JSON.stringify(fetchVerified)}, 'verified');
            console.log('[test] Global fetch and response parsing succeeded without WASM.');
        });
        await import(${JSON.stringify(pathToFileURL(path.join(server, 'ios-loader.mjs')).href)});
    `);

    const readyFile = path.join(path.dirname(server), 'server-ready.txt');
    const failureFile = path.join(path.dirname(server), 'server-failed.json');
    const child = spawn(process.execPath, [
        '--jitless', '--require', guard, entry,
        `--configPath=${configPath}`, `--dataRoot=${config.dataRoot}`, `--port=${port}`,
        '--listen=false', '--enableIPv4=true', '--enableIPv6=false', '--browserLaunchEnabled=false',
    ], {
        cwd: server,
        env: { ...process.env, TARVEN_SERVER_DIR: server, DATA_DIR: config.dataRoot },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    child.stdout.on('data', data => { log += data; });
    child.stderr.on('data', data => { log += data; });
    const exit = once(child, 'exit');
    const base = `http://127.0.0.1:${port}`;
    const startedAt = Date.now();
    try {
        while (!log.includes('[ios-frontend] Verified') || !fs.existsSync(readyFile) || !fs.existsSync(fetchVerified)) {
            assert.equal(child.exitCode, null, log);
            // The loader removes any stale markers before announcing this startup.
            if (log.includes('[test] WASM disabled') && fs.existsSync(failureFile)) {
                assert.fail(fs.readFileSync(failureFile, 'utf8') + '\n' + log);
            }
            assert.ok(Date.now() - startedAt < 45000, 'Server startup timed out:\n' + log);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const response = await fetch(base, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        assert.match(await response.text(), /SillyTavern/);

        const manifest = JSON.parse(fs.readFileSync(path.join(server, 'dist', 'ios-frontend', 'manifest.json'), 'utf8'));
        for (const asset of manifest.assets) {
            const url = `${base}/${asset.name}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            assert.equal(response.status, 200, asset.name);
            const bytes = Buffer.from(await response.arrayBuffer());
            assert.equal(bytes.length, asset.bytes, asset.name);
            assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.name);
            if (asset.name.endsWith('.js')) {
                assert.match(response.headers.get('content-type'), /javascript/);
            }
            const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            assert.equal(head.status, 200, asset.name);
            assert.equal((await head.arrayBuffer()).byteLength, 0);
        }
        assert.equal(fs.existsSync(failureFile), false, log);
        assert.doesNotMatch(log, /Runtime must not import webpack|Compiling frontend libraries/);
        t.diagnostic(`HTTP 200 for the homepage and ${manifest.assets.length} hash-verified assets; startup ${Date.now() - startedAt}ms.`);
    } finally {
        if (child.exitCode === null) {
            try { child.kill('SIGKILL'); } catch (_) {}
        }
        await Promise.race([
            exit,
            new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        if (process.env.SILLYCLIENT_TEST_LOG) {
            fs.writeFileSync(process.env.SILLYCLIENT_TEST_LOG, log);
        }
        for (const file of [readyFile, failureFile, path.join(server, 'data', 'server-ready.txt')]) {
            fs.rmSync(file, { force: true });
        }
    }
});
