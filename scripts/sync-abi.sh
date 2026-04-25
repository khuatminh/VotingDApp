#!/usr/bin/env bash
# Copies ABIs from contracts/out into frontend/src/contracts/.
# Optionally updates addresses.json for a given chainId from the latest broadcast run.
#
# Usage:
#   bash scripts/sync-abi.sh                # ABIs only
#   bash scripts/sync-abi.sh --chain 31337  # ABIs + addresses from latest local run
#   bash scripts/sync-abi.sh --chain 11155111

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/contracts/out"
DEST="$ROOT/frontend/src/contracts"

command -v jq >/dev/null || { echo "jq not installed. brew install jq" >&2; exit 1; }
[[ -d "$OUT" ]] || { echo "No contracts/out — run 'forge build' first." >&2; exit 1; }

sync_abi () {
  local name="$1"
  local src="$OUT/${name}.sol/${name}.json"
  local dst="$DEST/${name}.json"
  [[ -f "$src" ]] || { echo "Missing $src" >&2; exit 1; }
  jq '{ abi: .abi }' "$src" > "$dst"
  echo "  $name → $dst"
}

echo "Syncing ABIs…"
sync_abi VoterRegistry
sync_abi Election

CHAIN_ID=""
if [[ "${1:-}" == "--chain" ]]; then
  CHAIN_ID="${2:-}"
  [[ -n "$CHAIN_ID" ]] || { echo "--chain requires a chainId" >&2; exit 1; }
fi

if [[ -n "$CHAIN_ID" ]]; then
  BROADCAST="$ROOT/contracts/broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json"
  if [[ -f "$BROADCAST" ]]; then
    echo "Updating addresses.json for chain $CHAIN_ID…"
    REG=$(jq -r '.transactions[] | select(.contractName=="VoterRegistry") | .contractAddress' "$BROADCAST" | tail -n1)
    ELE=$(jq -r '.transactions[] | select(.contractName=="Election")      | .contractAddress' "$BROADCAST" | tail -n1)
    ADDR="$DEST/addresses.json"
    TMP=$(mktemp)
    jq --arg cid "$CHAIN_ID" --arg reg "$REG" --arg ele "$ELE" \
       '.[$cid] = { voterRegistry: $reg, election: $ele }' \
       "$ADDR" > "$TMP" && mv "$TMP" "$ADDR"
    echo "  VoterRegistry: $REG"
    echo "  Election:      $ELE"
  else
    echo "Warning: no broadcast file at $BROADCAST — addresses.json left unchanged." >&2
  fi
fi

echo "Done."
