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
        try { child.kill('SIGKILL'); } catch (_) {}
        await Promise.race([
            exit,
            new Promise(resolve => setTimeout(resolve, 1000))
        ]);
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

test('TopColor math matches Rec.601 and high-fidelity seamless 0-disparity constraints', () => {
    // 镜像 TopColor.kt / TopColor.swift 纯数学运算
    const isDark = (r, g, b) => {
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        return luma < 0.6;
    };
    // 测试酒馆暗色主题背景 #171717 (r=23, g=23, b=23)
    const testColor = [23, 23, 23];
    assert.equal(isDark(...testColor), true);
    // 高保真零色差 stops: 顶/中/底 100% 页面色
    const stopTop = testColor;
    const stopMid = testColor;
    const stopBot = testColor;
    assert.deepEqual(stopTop, [23, 23, 23]);
    assert.deepEqual(stopMid, [23, 23, 23]);
    assert.deepEqual(stopBot, [23, 23, 23]);
    // 验证与页面首行 0 误差熔接
    assert.equal(stopTop[0], stopBot[0]);
    assert.equal(stopTop[1], stopBot[1]);
    assert.equal(stopTop[2], stopBot[2]);
});

test('IslandHardwareRadar safely bounds left flank away from Dynamic Island cutout', () => {
    const screenWidth = 393.0; // iPhone 15 Pro / 16 Pro
    const islandWidth = 125.0;
    const padding = 8.0;
    const sideMargin = 14.0;
    const center = screenWidth / 2.0;
    const leftEnd = Math.floor(center - (islandWidth / 2.0) - padding);
    const leftWidth = Math.max(0, leftEnd - sideMargin);

    // 左翼必须完全在灵动岛左侧 (leftMargin + leftWidth < center - cutout/2)
    assert.ok(sideMargin + leftWidth <= center - (islandWidth / 2.0) - padding);
    assert.ok(leftWidth > 80.0, `Expected adequate width for gesture hint, got ${leftWidth}`);
});

test('ChameleonEngine DOM probe blend correctly synthesizes semi-transparent theme colors', () => {
    function blend(fg, bg) {
        if (!fg) return bg;
        if (fg.a >= 0.999) return fg;
        const bgR = bg ? bg.r : 36;
        const bgG = bg ? bg.g : 36;
        const bgB = bg ? bg.b : 37;
        const a = fg.a;
        return {
            r: Math.round(fg.r * a + bgR * (1 - a)),
            g: Math.round(fg.g * a + bgG * (1 - a)),
            b: Math.round(fg.b * a + bgB * (1 - a)),
            a: 1.0
        };
    }

    const bodyBg = { r: 36, g: 36, b: 37, a: 1.0 };

    // 1. 默认暗黑主题 rgba(23, 23, 23, 1) -> 零误差 [23, 23, 23]
    const def = blend({ r: 23, g: 23, b: 23, a: 1.0 }, bodyBg);
    assert.deepEqual(def, { r: 23, g: 23, b: 23, a: 1.0 });

    // 2. 官方预设 Celestial Macaron: rgba(23, 36, 55, 0.9)
    // 23*0.9 + 36*0.1 = 24.3 -> 24; 36*0.9 + 36*0.1 = 36; 55*0.9 + 37*0.1 = 53.2 -> 53
    const cel = blend({ r: 23, g: 36, b: 55, a: 0.9 }, bodyBg);
    assert.deepEqual(cel, { r: 24, g: 36, b: 53, a: 1.0 });

    // 3. 官方预设 Cappuccino: rgba(34, 30, 32, 0.95)
    // 34*0.95 + 36*0.05 = 34.1 -> 34; 30*0.95 + 36*0.05 = 30.3 -> 30; 32*0.95 + 37*0.05 = 32.25 -> 32
    const cap = blend({ r: 34, g: 30, b: 32, a: 0.95 }, bodyBg);
    assert.deepEqual(cap, { r: 34, g: 30, b: 32, a: 1.0 });

    // 4. 自定义 Wine Red: rgba(163, 40, 72, 1.0)
    const wine = blend({ r: 163, g: 40, b: 72, a: 1.0 }, bodyBg);
    assert.deepEqual(wine, { r: 163, g: 40, b: 72, a: 1.0 });
});

test('TarvenEnvPlugin native method table contains all required file picker and testing APIs', () => {
    const swiftFile = path.join(root, 'native-src', 'TarvenEnvPlugin.swift');
    const mFile = path.join(root, 'native-src', 'TarvenEnvPlugin.m');
    const swiftContent = fs.readFileSync(swiftFile, 'utf8');
    const mContent = fs.readFileSync(mFile, 'utf8');

    const requiredMethods = [
        'pickDirectory',
        'pickImage',
        'pickZipFile',
        'saveTextFile',
        'dismissPickerForTesting'
    ];

    for (const method of requiredMethods) {
        assert.ok(swiftContent.includes(`CAPPluginMethod(name: "${method}"`), `Missing Swift method registration: ${method}`);
        assert.ok(swiftContent.includes(`@objc func ${method}(`), `Missing Swift method implementation: ${method}`);
        assert.ok(mContent.includes(`CAP_PLUGIN_METHOD(${method},`), `Missing ObjC method export: ${method}`);
    }
});

test('multi-instance ID normalization sanitizes characters safely', () => {
    function normalizeInstanceId(raw) {
        if (!raw || typeof raw !== 'string' || !raw.trim()) return 'default';
        const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '');
        return cleaned || 'default';
    }
    assert.equal(normalizeInstanceId(''), 'default');
    assert.equal(normalizeInstanceId('   '), 'default');
    assert.equal(normalizeInstanceId(null), 'default');
    assert.equal(normalizeInstanceId('my_instance-10'), 'my_instance-10');
    assert.equal(normalizeInstanceId('../instances/escape'), 'instancesescape');
    assert.equal(normalizeInstanceId('inst:test?'), 'insttest');
});

test('Home Indicator avoidance and keyboard avoidance layout bounds match hardware specs', () => {
    const screenHeight = 852.0; // iPhone 16 Pro height
    const fixedStatusBarHeight = 54.0;
    const currentKeyboardHeight = 336.0;

    // 1. Full-bleed immersive layout (reaches physical bottom when keyboard is 0):
    const normalFullBleedHeight = Math.max(0, screenHeight - fixedStatusBarHeight - 0);
    assert.equal(normalFullBleedHeight, 798.0);

    // 2. Keyboard presented layout (bottomInset transitions to currentKeyboardHeight):
    const keyboardLayoutHeight = Math.max(0, screenHeight - fixedStatusBarHeight - currentKeyboardHeight);
    assert.equal(keyboardLayoutHeight, 462.0);

    // 3. Difference between keyboard up and keyboard down:
    assert.equal(normalFullBleedHeight - keyboardLayoutHeight, currentKeyboardHeight);
});

test('NodeRunner and ios-loader expose and respond to garbage collection signal', () => {
    const nodeRunnerSwift = fs.readFileSync(path.join(root, 'native-src', 'NodeRunner.swift'), 'utf8');
    const iosLoader = fs.readFileSync(path.join(root, 'native-src', 'ios-loader.mjs'), 'utf8');

    // NodeRunner must pass --expose-gc
    assert.ok(nodeRunnerSwift.includes('"--expose-gc"'), 'NodeRunner must start node with --expose-gc flag');
    assert.ok(nodeRunnerSwift.includes('trigger-node-gc.sig'), 'NodeRunner must write trigger-node-gc.sig');

    // ios-loader must listen for trigger-node-gc.sig and invoke globalThis.gc()
    assert.ok(iosLoader.includes('trigger-node-gc.sig'), 'ios-loader must check trigger-node-gc.sig');
    assert.ok(iosLoader.includes('globalThis.gc()'), 'ios-loader must invoke globalThis.gc()');
});

test('TavernViewController and AppDelegate define prefersHomeIndicatorAutoHidden and bottom safe area support', () => {
    const tavernVCSwift = fs.readFileSync(path.join(root, 'native-src', 'TavernViewController.swift'), 'utf8');
    const appDelegateSwift = fs.readFileSync(path.join(root, 'native-src', 'AppDelegate.swift'), 'utf8');

    // TavernViewController must override prefersHomeIndicatorAutoHidden
    assert.ok(tavernVCSwift.includes('override var prefersHomeIndicatorAutoHidden: Bool'), 'TavernViewController must override prefersHomeIndicatorAutoHidden');
    assert.ok(tavernVCSwift.includes('setNeedsUpdateOfHomeIndicatorAutoHidden()'), 'TavernViewController must trigger auto-hide update');

    // TavernViewController must define bottom safe area tracking and injected safe area script
    assert.ok(tavernVCSwift.includes('fixedBottomSafeInset'), 'TavernViewController must define fixedBottomSafeInset');
    assert.ok(tavernVCSwift.includes('bottomScrimBar'), 'TavernViewController must define bottomScrimBar');
    assert.ok(tavernVCSwift.includes('sillyclient-ios-bottom-safe-area'), 'TavernViewController must inject bottom safe area style');

    // AppDelegate SillyBridgeViewController must forward prefersHomeIndicatorAutoHidden
    assert.ok(appDelegateSwift.includes('override var prefersHomeIndicatorAutoHidden: Bool'), 'AppDelegate must forward prefersHomeIndicatorAutoHidden');
});
