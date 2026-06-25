#!/bin/bash
# Build server-source.zip from upstream SillyTavern release
# Usage: bash scripts/build-server-source.sh [tavern-tag]
set -euo pipefail

TAVERN_TAG="${1:-release}"
WORK_DIR=".cache/build-server"
OUTPUT="server-source.zip"

echo "=== Tarven++ Server Source Builder ==="
echo "Tavern tag: $TAVERN_TAG"

# Clean work dir
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

# Download SillyTavern release
echo "[1/4] Downloading SillyTavern $TAVERN_TAG..."
ST_URL="https://github.com/SillyTavern/SillyTavern/archive/refs/tags/${TAVERN_TAG}.zip"
curl -fsSL "$ST_URL" -o "$WORK_DIR/tavern.zip"

# Extract
echo "[2/4] Extracting..."
unzip -q "$WORK_DIR/tavern.zip" -d "$WORK_DIR/tavern-src"
SRC_DIR=$(find "$WORK_DIR/tavern-src" -maxdepth 1 -type d -name "SillyTavern-*" | head -1)

# Install dependencies
echo "[3/4] Installing node_modules..."
cd "$SRC_DIR"
npm install --omit=dev --no-audit --no-fund --prefer-offline 2>&1 | tail -3
cd -

# Package
echo "[4/4] Packaging server-source.zip..."
cd "$SRC_DIR"
zip -qr "../../${OUTPUT}" .
cd -

SIZE=$(du -h "$WORK_DIR/$OUTPUT" | cut -f1)
echo "Done: $WORK_DIR/$OUTPUT ($SIZE)"
rm -rf "$WORK_DIR/tavern-src" "$WORK_DIR/tavern.zip"