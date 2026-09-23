import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Installed as SillyTavern/src/middleware/webpack-serve.js after the host build.
const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
const assetRoot = path.join(serverRoot, 'dist', 'ios-frontend');

export default function getWebpackServeMiddleware() {
    let assets = null;

    function middleware(req, res, next) {
        const name = req.path?.slice(1);
        if (assets?.has(name) && (req.method === 'GET' || req.method === 'HEAD')) {
            return res.sendFile(name, { root: assetRoot, dotfiles: 'deny' });
        }
        next();
    }

    middleware.runWebpackCompiler = async () => {
        assets = null;
        const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
        const pkg = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf8'));
        if (manifest.format !== 1 || manifest.version !== pkg.version || !Array.isArray(manifest.assets)) {
            throw new Error('Invalid or incompatible iOS frontend manifest. Rebuild the application.');
        }

        const verified = new Set();
        for (const asset of manifest.assets) {
            const name = asset.name;
            if (typeof name !== 'string' || !name || name.includes('\\') || name.includes(':')
                || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))
                || verified.has(name) || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
                throw new Error('Invalid asset entry in the iOS frontend manifest.');
            }
            const file = path.join(assetRoot, name);
            const realRoot = fs.realpathSync(assetRoot);
            const relative = path.relative(realRoot, fs.realpathSync(file));
            if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(file).isFile()) {
                throw new Error(`Invalid iOS frontend asset path: ${name}`);
            }
            const content = fs.readFileSync(file);
            if (content.length !== asset.bytes
                || createHash('sha256').update(content).digest('hex') !== asset.sha256) {
                throw new Error(`iOS frontend asset verification failed: ${name}`);
            }
            verified.add(name);
        }
        if (!verified.has('lib.js')) {
            throw new Error('The prebuilt iOS frontend is missing lib.js.');
        }
        assets = verified;
        console.log(`[ios-frontend] Verified ${assets.size} prebuilt assets; runtime compilation disabled.`);
    };

    return middleware;
}
