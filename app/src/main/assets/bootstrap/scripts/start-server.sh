#!/system/bin/sh
set -eu

echo "[Tarven++] Starting SillyTavern server..."

: "${TARVEN_SERVER_DIR:?TARVEN_SERVER_DIR missing}"
: "${TARVEN_USR:?TARVEN_USR missing}"
: "${TARVEN_TMP:?TARVEN_TMP missing}"
: "${TARVEN_NODE:?TARVEN_NODE missing}"

cd "$TARVEN_SERVER_DIR"

export HOME="$TARVEN_HOME"
export TMPDIR="$TARVEN_TMP"
export PATH="$TARVEN_USR/bin:$PATH"
export LD_LIBRARY_PATH="$TARVEN_USR/lib:$TARVEN_NATIVE_LIB_DIR:${LD_LIBRARY_PATH:-}"
export NODE_ENV=production

if [ ! -f "server.js" ]; then
  echo "[Tarven++] server.js not found in $TARVEN_SERVER_DIR"
  exit 11
fi

# Write config to disable browser launch and enable headless mode
cat > config.yaml <<'CONFIG'
listen: false
protocol:
  ipv4: true
  ipv6: false
whitelistMode: false
browserLaunch:
  enabled: false
dataRoot: ./data
port: 8000
CONFIG

echo "[Tarven++] node=$TARVEN_NODE"
echo "[Tarven++] server=$TARVEN_SERVER_DIR/server.js"
echo "[Tarven++] url=http://127.0.0.1:8000/"

exec "$TARVEN_NODE" server.js