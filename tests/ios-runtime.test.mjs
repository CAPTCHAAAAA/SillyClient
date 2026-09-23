import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from '../scripts/prepare-ios-frontend.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function fixture(t) {
    const parent = process.env.SILLYCLIENT_TEST_TMP || os.tmpdir();
    fs.mkdirSync(parent, { recursive: true });
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(parent, 'ios-runtime-')));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const server = path.join(directory, 'SillyTavern');
    const output = path.join(server, 'dist', 'ios-frontend');
    fs.mkdirSync(path.join(server, 'src', 'middleware'), { recursive: true });
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(server, 'package.json'), JSON.stringify({ type: 'module', version: 'test' }));
    const module = path.join(server, 'src', 'middleware', 'webpack-serve.js');
    fs.copyFileSync(path.join(root, 'native-src', 'prebuilt-webpack.mjs'), module);
    // Neither runtime import may evaluate webpack or its configuration.
    fs.writeFileSync(path.join(server, 'webpack.config.js'), 'throw new Error("Runtime imported webpack config");');
    const contents = 'export const verified = true;';
    fs.writeFileSync(path.join(output, 'lib.js'), contents);
    const manifest = {
        format: 1,
        version: 'test',
        assets: [{ name: 'lib.js', bytes: Buffer.byteLength(contents), sha256: createHash('sha256').update(contents).digest('hex') }],
    };
    const save = () => fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest));
    save();
    const load = async () => (await import(pathToFileURL(module).href)).default();
    return { directory, server, output, manifest, module, save, load };
}

test('prebuilt frontend is validated and served without WASM or webpack', t => {
    const f = fixture(t);
    const script = `
        import assert from 'node:assert/strict';
        const { default: createMiddleware } = await import(${JSON.stringify(pathToFileURL(f.module).href)});
        assert.equal(typeof WebAssembly, 'undefined');
        const middleware = createMiddleware();
        await middleware.runWebpackCompiler({ pruneCache: true });
        for (const method of ['GET', 'HEAD']) {
            let served = false;
            middleware({ method, path: '/lib.js' }, {
                sendFile(name, options) {
                    assert.equal(name, 'lib.js');
                    assert.equal(fs.realpathSync(options.root), fs.realpathSync(${JSON.stringify(f.output)}));
                    served = true;
                }
            }, () => assert.fail('Unexpected fallthrough'));
            assert.equal(served, true);
        }
        let passed = 0;
        for (const req of [{ method: 'GET', path: '/missing.js' }, { method: 'POST', path: '/lib.js' }]) {
            middleware(req, {}, () => passed++);
        }
        assert.equal(passed, 2);
    `;
    const result = spawnSync(process.execPath, ['--jitless', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('asset corruption with unchanged size fails before readiness', async t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.output, 'lib.js'), 'x'.repeat(f.manifest.assets[0].bytes));
    await assert.rejects((await f.load()).runWebpackCompiler(), /verification failed/);
});

test('a missing asset is not replaced by runtime compilation', async t => {
    const f = fixture(t);
    fs.unlinkSync(path.join(f.output, 'lib.js'));
    await assert.rejects((await f.load()).runWebpackCompiler(), /ENOENT/);
});

test('a missing manifest fails closed', async t => {
    const f = fixture(t);
    fs.unlinkSync(path.join(f.output, 'manifest.json'));
    await assert.rejects((await f.load()).runWebpackCompiler(), /ENOENT/);
});

test('frontend version must match the server', async t => {
    const f = fixture(t);
    f.manifest.version = 'different';
    f.save();
    await assert.rejects((await f.load()).runWebpackCompiler(), /incompatible/);
});

for (const name of ['../outside.js', '/absolute.js', 'dir\\file.js', 'C:/file.js', '.hidden', 'dir/../lib.js']) {
    test(`unsafe manifest asset is rejected: ${name}`, async t => {
        const f = fixture(t);
        f.manifest.assets[0].name = name;
        f.save();
        await assert.rejects((await f.load()).runWebpackCompiler(), /Invalid asset entry/);
    });
}

test('manifest requires lib.js and unique entries', async t => {
    const f = fixture(t);
    const middleware = await f.load();
    f.manifest.assets.push({ ...f.manifest.assets[0] });
    f.save();
    await assert.rejects(middleware.runWebpackCompiler(), /Invalid asset entry/);
    f.manifest.assets = [];
    f.save();
    await assert.rejects(middleware.runWebpackCompiler(), /missing lib.js/);
    f.manifest.assets = [{ name: 'lib.js', bytes: 0, sha256: 'bad' }];
    f.save();
    await assert.rejects(middleware.runWebpackCompiler(), /Invalid asset entry/);
});

for (const scenario of ['callback', 'stats', 'throw', 'close']) {
    test(`host compilation rejects ${scenario} failure and closes the compiler`, async () => {
        let closed = 0;
        const compiler = {
            run(callback) {
                if (scenario === 'throw') throw new Error('compile error');
                callback(scenario === 'callback' ? new Error('compile error') : null, {
                    hasErrors: () => scenario === 'stats',
                    toString: () => 'compile error',
                });
            },
            close(callback) {
                closed++;
                callback(scenario === 'close' ? new Error('close error') : null);
            },
        };
        await assert.rejects(compile(compiler), /error/);
        assert.equal(closed, 1);
    });
}

test('host compilation only resolves after a successful close', async () => {
    let closed = false;
    await compile({
        run: callback => callback(null, { hasErrors: () => false, toString: () => 'compiled test fixture' }),
        close(callback) { closed = true; callback(); },
    });
    assert.equal(closed, true);
});

test('loader reports startup failure promptly and does not synthesize WASM', async t => {
    const f = fixture(t);
    const fetchPackage = path.join(f.server, 'node_modules', 'node-fetch');
    fs.mkdirSync(fetchPackage, { recursive: true });
    fs.writeFileSync(path.join(fetchPackage, 'package.json'), JSON.stringify({ type: 'module', main: 'index.js' }));
    fs.writeFileSync(path.join(fetchPackage, 'index.js'), `
        export default function testFetch() {}
        export class Headers {}
        export class Request {}
        export class Response {}
        export class FormData {}
        export class Blob {}
        export class File {}
    `);
    fs.copyFileSync(path.join(root, 'native-src', 'ios-loader.mjs'), path.join(f.server, 'ios-loader.mjs'));
    fs.writeFileSync(path.join(f.server, 'server.js'), `
        import assert from 'node:assert/strict';
        import fetch, * as implementation from 'node-fetch';
        if (typeof WebAssembly !== 'undefined') throw new Error('Fabricated WASM');
        assert.equal(globalThis.fetch, fetch);
        for (const name of ['Headers', 'Request', 'Response', 'FormData', 'Blob', 'File']) {
            assert.equal(globalThis[name], implementation[name]);
        }
        Promise.reject(new Error('expected startup failure'));
    `);
    fs.writeFileSync(path.join(f.directory, 'server-ready.txt'), 'stale');
    const child = spawn(process.execPath, ['--jitless', path.join(f.server, 'ios-loader.mjs')], {
        env: { ...process.env, TARVEN_SERVER_DIR: f.server },
        stdio: 'ignore',
    });
    const exit = once(child, 'exit');
    try {
        const failureFile = path.join(f.directory, 'server-failed.json');
        const deadline = Date.now() + 10000;
        while (!fs.existsSync(failureFile) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(JSON.parse(fs.readFileSync(failureFile, 'utf8')).message, 'expected startup failure');
        assert.equal(fs.existsSync(path.join(f.directory, 'server-ready.txt')), false);
    } finally {
        child.kill();
        await exit;
    }
});

for (const lite of [false, true]) {
    test(`no-WASM tokenizer fallback rejects instead of inventing tokens (${lite ? 'lite' : 'full'})`, t => {
        const f = fixture(t);
        const target = path.join(f.server, 'node_modules', 'tiktoken', ...(lite ? ['lite'] : []));
        fs.mkdirSync(target, { recursive: true });
        const exports = lite ? ['Tiktoken'] : ['get_encoding', 'encoding_for_model', 'get_encoding_name_for_model', 'Tiktoken'];
        fs.writeFileSync(path.join(target, 'tiktoken.cjs'), `const bytes = [];
const imports = {};
const wasm = {};
const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
wasm.__wbg_set_wasm(wasmInstance.exports);
${exports.map(name => `exports["${name}"] = wasm["${name}"];`).join('\n')}`);
        const patched = spawnSync(process.execPath, [path.join(root, 'native-src', 'patch-sillytavern.mjs'), f.server], { encoding: 'utf8' });
        assert.equal(patched.status, 0, patched.stderr);
        const script = `
        const assert = require('node:assert/strict');
        const tokenizer = require(${JSON.stringify(path.join(target, 'tiktoken.cjs'))});
        assert.throws(() => ${lite ? 'new tokenizer.Tiktoken({})' : "tokenizer.get_encoding('cl100k_base')"}, { code: 'ERR_IOS_WASM_UNAVAILABLE' });
    `;
        const result = spawnSync(process.execPath, ['--jitless', '-e', script], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stdout + result.stderr);
    });
}
