#!/usr/bin/env bash
# One-shot local development loop:
#   1. start anvil in the background
#   2. forge build
#   3. deploy to anvil
#   4. sync ABIs + addresses
#   5. start vite dev server
#
# On exit (Ctrl-C), anvil is killed.

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)

cleanup () {
  if [[ -n "${ANVIL_PID:-}" ]]; then
    kill "$ANVIL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Starting anvil on :8545…"
(cd "$ROOT/contracts" && anvil --silent) &
ANVIL_PID=$!
sleep 2

echo "Building contracts…"
(cd "$ROOT/contracts" && forge build)

# Use anvil's well-known first account key. Never use this on mainnet.
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo "Deploying to anvil…"
(cd "$ROOT/contracts" && PRIVATE_KEY="$ANVIL_KEY" forge script script/Deploy.s.sol \
    --rpc-url local --broadcast --skip-simulation)

echo "Syncing ABIs + addresses…"
bash "$ROOT/scripts/sync-abi.sh" --chain 31337

echo "Starting vite…"
(cd "$ROOT/frontend" && npm run dev)
