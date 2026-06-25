#!/usr/bin/env bash
set -euo pipefail

# Tarven++ v0.1 - Server Source Builder
# Goal: build artifacts/server-source/<ref>/server-source.zip on the PC/WSL side.
# This does NOT build an Android APK and does NOT modify Termux.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REPO_URL="https://github.com/SillyTavern/SillyTavern.git"
BRANCH="release"
TAG=""
WORK_ROOT="$ROOT_DIR/work"
OUT_ROOT="$ROOT_DIR/artifacts/server-source"
NPM_OMIT_DEV="true"
KEEP_WORK="false"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/build-server-source.sh [options]

Options:
  --repo <url>        SillyTavern git repo. Default: https://github.com/SillyTavern/SillyTavern.git
  --branch <name>     Branch to clone when --tag is not set. Default: release
  --tag <tag>         Specific SillyTavern tag. If set, overrides --branch.
  --work-root <path>  Working directory. Default: ./work
  --out-root <path>   Output directory. Default: ./artifacts/server-source
  --keep-work         Keep temporary source directory after packing.
  -h, --help          Show help.

Output:
  artifacts/server-source/<branch-or-tag>/server-source.zip
  artifacts/server-source/<branch-or-tag>/server-source-manifest.json
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --work-root) WORK_ROOT="$2"; shift 2 ;;
    --out-root) OUT_ROOT="$2"; shift 2 ;;
    --keep-work) KEEP_WORK="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unsupported argument: $1" >&2; usage >&2; exit 1 ;;
  esac
done

log() { printf '[Tarven++] %s\n' "$*"; }
fail() { printf '[Tarven++ ERROR] %s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"; }

need_cmd git
need_cmd node
need_cmd npm
need_cmd python3

NODE_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node.js 20+ is recommended/required for current SillyTavern builds. Current: $(node -v). Install Node.js LTS in WSL first."
fi

if [[ -n "$TAG" ]]; then
  REF_NAME="$TAG"
  CLONE_REF="$TAG"
  REF_KIND="tag"
else
  REF_NAME="$BRANCH"
  CLONE_REF="$BRANCH"
  REF_KIND="branch"
fi

SAFE_REF="${REF_NAME//\//_}"
SOURCE_DIR="$WORK_ROOT/sillytavern-$SAFE_REF"
NPM_CACHE="$ROOT_DIR/.cache/npm"
TARGET_DIR="$OUT_ROOT/$SAFE_REF"
ZIP_PATH="$TARGET_DIR/server-source.zip"
MANIFEST_PATH="$TARGET_DIR/server-source-manifest.json"

mkdir -p "$WORK_ROOT" "$NPM_CACHE" "$TARGET_DIR"
rm -rf "$SOURCE_DIR"

log "Project root: $ROOT_DIR"
log "Repo: $REPO_URL"
log "Ref: $REF_KIND $REF_NAME"
log "Work: $SOURCE_DIR"
log "Output: $TARGET_DIR"

log "[1/5] Clone SillyTavern"
git clone --depth=1 --branch "$CLONE_REF" "$REPO_URL" "$SOURCE_DIR"

cd "$SOURCE_DIR"
GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || printf 'unknown')"
GIT_DESCRIBE="$(git describe --tags --always 2>/dev/null || printf '%s' "$REF_NAME")"

log "[2/5] Clean mutable/runtime folders"
rm -rf .git data backups node_modules
find . -name '.DS_Store' -type f -delete

[[ -f package.json ]] || fail "package.json not found after clone."
[[ -f start.sh ]] || fail "start.sh not found after clone."

log "[3/5] Install npm runtime dependencies"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE"
else
  npm install --omit=dev --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE"
fi

if [[ ! -d node_modules ]]; then
  fail "node_modules was not created. npm dependency install failed."
fi

# SillyDroid observed that command-exists can be required at runtime; keep the check generic and non-invasive.
COMMAND_EXISTS_VERSION="$(node - <<'NODE'
const pkg = require('./package.json');
const v = pkg.dependencies && pkg.dependencies['command-exists'];
process.stdout.write(v || '');
NODE
)"
if [[ -n "$COMMAND_EXISTS_VERSION" && ! -d node_modules/command-exists ]]; then
  log "[fix] Install missing runtime dependency command-exists@$COMMAND_EXISTS_VERSION"
  npm install --omit=dev --no-audit --no-fund --prefer-offline --cache "$NPM_CACHE" --no-save "command-exists@$COMMAND_EXISTS_VERSION"
fi

log "[4/5] Pack server-source.zip"
rm -f "$ZIP_PATH" "$MANIFEST_PATH"
python3 - "$SOURCE_DIR" "$ZIP_PATH" "$MANIFEST_PATH" "$REF_NAME" "$REF_KIND" "$GIT_COMMIT" "$GIT_DESCRIBE" <<'PY'
import hashlib
import json
import os
import sys
import time
import zipfile
from pathlib import Path

source = Path(sys.argv[1]).resolve()
zip_path = Path(sys.argv[2]).resolve()
manifest_path = Path(sys.argv[3]).resolve()
ref_name = sys.argv[4]
ref_kind = sys.argv[5]
git_commit = sys.argv[6]
git_describe = sys.argv[7]

exclude_dirs = {'.git', 'data', 'backups'}
files = []
for path in source.rglob('*'):
    if not path.is_file():
        continue
    rel = path.relative_to(source).as_posix()
    if any(part in exclude_dirs for part in path.relative_to(source).parts):
        continue
    files.append((rel, path))
files.sort(key=lambda item: item[0])

zip_path.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for rel, path in files:
        zf.write(path, rel)

h = hashlib.sha256()
with zip_path.open('rb') as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b''):
        h.update(chunk)

required = ['package.json', 'start.sh', 'node_modules']
with zipfile.ZipFile(zip_path, 'r') as zf:
    names = set(zf.namelist())
    has_package = 'package.json' in names
    has_start = 'start.sh' in names
    has_node_modules = any(name.startswith('node_modules/') for name in names)

manifest = {
    'package': 'TarvenPlusPlusServerSource',
    'projectName': 'Tarven++',
    'schemaVersion': 1,
    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'source': {
        'repository': 'https://github.com/SillyTavern/SillyTavern.git',
        'refKind': ref_kind,
        'refName': ref_name,
        'gitCommit': git_commit,
        'gitDescribe': git_describe,
    },
    'payload': {
        'archiveFile': zip_path.name,
        'archiveSizeBytes': zip_path.stat().st_size,
        'archiveSha256': h.hexdigest(),
        'archivedFileCount': len(files),
        'includesNodeModules': has_node_modules,
        'hasPackageJson': has_package,
        'hasStartSh': has_start,
    }
}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if not has_package or not has_start or not has_node_modules:
    print('server-source.zip missing required content', file=sys.stderr)
    print(json.dumps(manifest, ensure_ascii=False, indent=2), file=sys.stderr)
    raise SystemExit(1)

print(f'Packed {len(files)} files')
print(f'SHA256 {h.hexdigest()}')
PY

log "[5/5] Verify archive"
python3 - "$ZIP_PATH" <<'PY'
import sys, zipfile
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'r') as zf:
    names = zf.namelist()
    checks = {
        'package.json': 'package.json' in names,
        'start.sh': 'start.sh' in names,
        'node_modules/': any(n.startswith('node_modules/') for n in names),
    }
for k, ok in checks.items():
    print(f'{k}: {"OK" if ok else "MISSING"}')
if not all(checks.values()):
    raise SystemExit(1)
PY

if [[ "$KEEP_WORK" != "true" ]]; then
  rm -rf "$SOURCE_DIR"
fi

log "Done."
log "Archive: $ZIP_PATH"
log "Manifest: $MANIFEST_PATH"
