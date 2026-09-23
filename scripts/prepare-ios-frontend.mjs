import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function compile(compiler) {
    return new Promise((resolve, reject) => {
        const finish = (error, stats) => {
            compiler.close(closeError => {
                if (error || closeError) return reject(error || closeError);
                if (!stats || stats.hasErrors()) {
                    return reject(new Error(stats?.toString({ all: false, errors: true }) || 'Webpack returned no stats.'));
                }
                console.log(stats.toString({ preset: 'minimal', colors: false }));
                resolve();
            });
        };
        try {
            compiler.run(finish);
        } catch (error) {
            finish(error);
        }
    });
}

export async function prepareIosFrontend(directory) {
    const serverRoot = fs.realpathSync(directory);
    const assetRoot = path.join(serverRoot, 'dist', 'ios-frontend');
    const middlewareFile = path.join(serverRoot, 'src', 'middleware', 'webpack-serve.js');
    const require = createRequire(path.join(serverRoot, 'package.json'));
    const webpack = require('webpack');
    const cwd = process.cwd();

    process.chdir(serverRoot);
    try {
        fs.mkdirSync(assetRoot, { recursive: true });
        // A failed rebuild must never leave an old manifest looking valid.
        fs.rmSync(path.join(assetRoot, 'manifest.json'), { force: true });
        const { default: getConfig } = await import(pathToFileURL(path.join(serverRoot, 'webpack.config.js')).href);
        const config = getConfig({ forceDist: true });
        config.cache = false;
        config.output = { ...config.output, path: assetRoot, clean: true };
        await compile(webpack(config));

        const assets = [];
        function collect(directory, prefix = '') {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const file = path.join(directory, entry.name);
                const name = prefix + entry.name;
                if (entry.isDirectory()) collect(file, name + '/');
                else if (entry.isFile()) {
                    const data = fs.readFileSync(file);
                    assets.push({ name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
                } else throw new Error(`Unsupported frontend output: ${name}`);
            }
        }
        collect(assetRoot);
        if (!assets.some(asset => asset.name === 'lib.js' && asset.bytes > 0)) {
            throw new Error('Webpack did not produce a nonempty lib.js.');
        }
        assets.sort((a, b) => a.name.localeCompare(b.name));
        const { version } = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf8'));
        fs.writeFileSync(path.join(assetRoot, 'manifest.json'), JSON.stringify({ format: 1, version, assets }, null, 2) + '\n');
        fs.copyFileSync(fileURLToPath(new URL('../native-src/prebuilt-webpack.mjs', import.meta.url)), middlewareFile);
        console.log(`[ios-frontend] Prepared ${assets.length} assets for SillyTavern ${version}.`);
    } finally {
        process.chdir(cwd);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    if (!process.argv[2]) throw new Error('Usage: node scripts/prepare-ios-frontend.mjs <SillyTavern directory>');
    await prepareIosFrontend(process.argv[2]);
}
