# Voting DApp

Decentralized voting DApp on Ethereum. Academic project (BTL Thực tập cơ sở).

- **Contracts:** Foundry + Solidity 0.8.24 + OpenZeppelin v5 (AccessControl)
- **Frontend:** React + Vite + Ethers.js v6 + MetaMask
- **Architecture:** Two-contract composition (`VoterRegistry` + `Election`), nested mappings for multi-election state, multi-admin via `AccessControl`, per-election voter authorization, richer candidates (name/description/imageUrl).

See [`docs/superpowers/specs/2026-04-25-voting-dapp-design.md`](docs/superpowers/specs/2026-04-25-voting-dapp-design.md) for the full design.

## Prerequisites

- Node 18+
- Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- `jq` (used by `sync-abi.sh`): `brew install jq`

## First-time setup

```bash
# 1. install frontend deps
cd frontend && npm install && cd ..

# 2. install contract deps
cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts && cd ..

# 3. copy env templates
cp contracts/.env.example contracts/.env
cp frontend/.env.example  frontend/.env
```

## Local dev loop

```bash
bash scripts/dev.sh
```

That script starts anvil, deploys, syncs ABIs + addresses, and launches Vite at http://localhost:5173.

If you prefer to run the pieces manually:

```bash
# Terminal 1
cd contracts && anvil

# Terminal 2
cd contracts && PRIVATE_KEY=0xac0974... forge script script/Deploy.s.sol --rpc-url local --broadcast
bash scripts/sync-abi.sh --chain 31337

# Terminal 3
cd frontend && npm run dev
```

## Deploy to Sepolia

```bash
# contracts/.env must have PRIVATE_KEY, SEPOLIA_RPC_URL (optional: SEED_ADMINS, ETHERSCAN_API_KEY)
cd contracts
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
cd ..
bash scripts/sync-abi.sh --chain 11155111
git add frontend/src/contracts/addresses.json
git commit -m "chore: deploy to Sepolia"
```

## Testing

```bash
cd contracts && forge test -vv
```

## File ownership (Phase 1 + Phase 2)

| File / area | Owner |
|---|---|
| `contracts/src/VoterRegistry.sol` + its test | Dev A |
| `contracts/src/Election.sol` + its test     | Dev B |
| `contracts/script/Deploy.s.sol`             | Dev B |
| `frontend/src/lib/wallet.js`                | Dev A |
| `frontend/src/hooks/*`                      | Dev A |
| `frontend/src/components/{Layout,ConnectButton,AddressBadge}.jsx` | Dev A |
| `frontend/src/pages/AdminPage.jsx`          | Dev A |
| `frontend/src/components/{ElectionSelector,CandidateCard}.jsx`   | Dev B |
| `frontend/src/pages/{VotePage,ResultsPage}.jsx` | Dev B |
| `scripts/sync-abi.sh`, `scripts/dev.sh`     | Dev B |
| Report, slides, demo script                 | Teammate 3 |

## Workflow

Both devs start from skeletons with `TODO(Dev A)` / `TODO(Dev B)` markers. Each TODO quotes the spec rule it implements. Fill bodies, extend tests, commit frequently. Kickoff each phase with a short meeting to lock any cross-file naming before parallel work begins.

## Demo script (6 steps)

1. Connect MetaMask on `/admin` (deployer account = admin).
2. Create election "Student Council 2026".
3. Add 3 candidates with images + descriptions.
4. Authorize 2 voter addresses.
5. Start election. Switch MetaMask to voter; vote on `/vote`.
6. Switch back, end election on `/admin`, view winner on `/results`.
