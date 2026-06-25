#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE="$ROOT_DIR/cache/deb"
WORK="$ROOT_DIR/work/tarven-runtime"
JNI="$WORK/jniLibs/arm64-v8a"
ROOTFS="$WORK/rootfs"

REPO="https://packages.termux.dev/apt/termux-main"
INDEX="${REPO}/dists/stable/main/binary-aarch64/Packages"

log() { printf "[Tarven++] %s\n" "$*"; }
need() { command -v "$1" >/dev/null 2>&1 || { log "ERROR: Need $1. apt install $1"; exit 1; }; }

need curl; need ar; need tar; need patchelf; need python3

rm -rf "$WORK"
mkdir -p "$WORK" "$JNI" "$ROOTFS/bin" "$ROOTFS/lib" "$ROOTFS/etc/ssl/certs" "$CACHE"

log "Fetching package index..."
curl -fsSL -o "$WORK/Packages" "$INDEX"

log "Downloading nodejs-lts..."
python3 - "$WORK/Packages" "$CACHE" "$REPO" "nodejs-lts" <<'PY'
import sys, re, os, subprocess

idx=open(sys.argv[1]).read()
cache=sys.argv[2]
repo=sys.argv[3]
target=sys.argv[4]

os.makedirs(cache,exist_ok=True)

entries=idx.split('\n\n')
for e in entries:
    lines=e.split('\n')
    pkg=''
    fn=''
    for l in lines:
        if l.startswith('Package: '): pkg=l.split(': ',1)[1]
        if l.startswith('Filename: '): fn=l.split(': ',1)[1]
    if pkg==target and fn:
        url=f"{repo}/{fn}"
        out=os.path.join(cache,os.path.basename(fn))
        if not os.path.exists(out):
            print(f"Downloading {url}")
            subprocess.run(['curl','-fsSL','-o',out,url],check=True)
        print(out)
        break
PY

deb=$(tail -1 "$WORK/Packages" 2>/dev/null || true)
log "DEB file: $deb"