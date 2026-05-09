# Voting DApp

A decentralized voting application on Ethereum. Academic project (BTL Thực tập cơ sở).

- **Smart contracts:** Foundry + Solidity 0.8.24 + OpenZeppelin v5 (`AccessControl`)
- **Frontend:** React 18 + Vite 5 + Ethers.js v6 + MetaMask
- **Architecture:** two-contract composition (`VoterRegistry` + `Election`), nested mappings for multi-election state, multi-admin via `AccessControl`, per-election voter authorization, candidates with name/description/imageUrl, election thumbnails.

Full design spec: [docs/superpowers/specs/2026-04-25-voting-dapp-design.md](docs/superpowers/specs/2026-04-25-voting-dapp-design.md)

---

## Table of contents

1. [What you'll need](#1-what-youll-need)
2. [Install prerequisites](#2-install-prerequisites)
3. [Clone & install dependencies](#3-clone--install-dependencies)
4. [Configure environment files](#4-configure-environment-files)
5. [Autorun (one-command local dev)](#5-autorun-one-command-local-dev)
6. [Manual run (terminal-by-terminal)](#6-manual-run-terminal-by-terminal)
7. [MetaMask demo wallet setup](#7-metamask-demo-wallet-setup)
8. [End-to-end demo walkthrough](#8-end-to-end-demo-walkthrough)
9. [Deploy to Sepolia testnet](#9-deploy-to-sepolia-testnet)
10. [Testing](#10-testing)
11. [Project structure](#11-project-structure)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What you'll need

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Frontend dev server, npm |
| **Git** | any recent | Clone + submodules |
| **Foundry** (`forge`, `anvil`, `cast`) | latest | Compile, test, deploy contracts; run local chain |
| **jq** | any | Used by `scripts/sync-abi.sh` |
| **MetaMask** | browser extension | Sign transactions in the dApp |
| **Modern browser** | Chrome / Brave / Firefox | Hosts MetaMask + the Vite dev server |

> No real ETH or paid RPC required for the local demo — Anvil ships with 10 funded test accounts.

---

## 2. Install prerequisites

### macOS

```bash
# Node 18+ (Homebrew)
brew install node

# Foundry
curl -L https://foundry.paradigm.xyz | bash
exec $SHELL -l
foundryup

# jq
brew install jq
```

### Linux (Debian/Ubuntu)

```bash
# Node 18+ via nodesource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Foundry
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

# jq
sudo apt install -y jq
```

### Windows

Use **WSL2** (Ubuntu) and follow the Linux steps above. Native Windows works for the frontend only — Foundry expects a Unix-like shell.

### Verify

```bash
node --version       # v18.x or higher
forge --version      # forge 0.x.x
anvil --version      # anvil 0.x.x
jq --version         # jq-1.x
```

---

## 3. Clone & install dependencies

```bash
# Clone with submodules (forge-std + openzeppelin-contracts)
git clone --recurse-submodules <your-repo-url> voting-dapp
cd voting-dapp

# If you already cloned without submodules:
git submodule update --init --recursive

# Frontend deps
cd frontend && npm install && cd ..

# Contract deps (only needed if submodules failed to fetch)
cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts && cd ..
```

---

## 4. Configure environment files

Both `.env` files are gitignored. Copy from the templates:

```bash
cp contracts/.env.example contracts/.env
cp frontend/.env.example  frontend/.env
```

### `contracts/.env`

| Variable | When required | Notes |
|---|---|---|
| `PRIVATE_KEY` | Sepolia deploys only | Use a throwaway account. For Anvil, the autorun script supplies a well-known key automatically. |
| `SEPOLIA_RPC_URL` | Sepolia deploys only | Alchemy / Infura / public endpoint. |
| `ETHERSCAN_API_KEY` | optional | Enables `forge verify-contract`. |
| `SEED_ADMINS` | optional | Comma-separated addresses granted `ADMIN_ROLE` at deploy time. |

### `frontend/.env`

| Variable | Default | Notes |
|---|---|---|
| `VITE_DEFAULT_CHAIN_ID` | `31337` | `31337` = Anvil, `11155111` = Sepolia. |
| `VITE_SEPOLIA_RPC` | empty | Optional explicit Sepolia RPC; otherwise the app uses MetaMask's provider. |

**For local demo, the defaults are fine — leave both files as the templates dictate.**

---

## 5. Autorun (one-command local dev)

The simplest path: a single script that starts Anvil, builds + deploys contracts, syncs ABIs and addresses into the frontend, then launches Vite.

```bash
bash scripts/dev.sh
# or
npm run dev
```

What it does (see [scripts/dev.sh](scripts/dev.sh)):

1. Starts `anvil` on `127.0.0.1:8545` (chain id `31337`) in the background.
2. Runs `forge build` to compile [contracts/src/VoterRegistry.sol](contracts/src/VoterRegistry.sol) and [contracts/src/Election.sol](contracts/src/Election.sol).
3. Deploys both contracts with [contracts/script/Deploy.s.sol](contracts/script/Deploy.s.sol), funded by Anvil's first prefunded key.
4. Calls [scripts/sync-abi.sh](scripts/sync-abi.sh) to copy ABIs and contract addresses to [frontend/src/contracts/](frontend/src/contracts/).
5. Starts the Vite dev server at **http://localhost:5173**.

When you press `Ctrl-C`, the script kills Anvil cleanly. **Important:** every time you stop and restart `anvil`, the chain resets — you must redeploy (just rerun `npm run dev`).

---

## 6. Manual run (terminal-by-terminal)

If you want to control each piece (e.g. keep Anvil running across sessions):

```bash
# Terminal 1 — local chain
cd contracts && anvil
```

```bash
# Terminal 2 — build + deploy + sync
cd contracts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url local --broadcast
cd ..
bash scripts/sync-abi.sh --chain 31337
```

```bash
# Terminal 3 — frontend
cd frontend && npm run dev
```

The frontend reads contract addresses from [frontend/src/contracts/addresses.json](frontend/src/contracts/addresses.json), which `sync-abi.sh` keeps in sync.

---

## 7. MetaMask demo wallet setup

You don't need a real wallet for local dev — Anvil ships ten deterministic, pre-funded accounts (10,000 ETH each). Here's how to wire MetaMask up to use them.

### 7.1 Install MetaMask

1. Visit https://metamask.io/download and install the extension for your browser.
2. Open the extension. Choose **"Create a new wallet"** (any password — this is throwaway). Save the seed phrase somewhere; it only exists locally.
3. You now have an empty wallet with one default account.

### 7.2 Add the local Anvil network

Anvil is not in MetaMask's default network list — add it manually.

1. Click the network dropdown at the top of MetaMask (default: "Ethereum Mainnet").
2. Click **"Add network"** → **"Add a network manually"**.
3. Fill in:

   | Field | Value |
   |---|---|
   | Network name | `Anvil Local` |
   | New RPC URL | `http://127.0.0.1:8545` |
   | Chain ID | `31337` |
   | Currency symbol | `ETH` |
   | Block explorer URL | (leave blank) |

4. **Save**, then switch the active network to **Anvil Local**.

> If MetaMask warns "could not fetch chain ID" — make sure `anvil` is running (Step 5 or Step 6).

### 7.3 Import demo accounts (deterministic Anvil keys)

Anvil always boots with the same ten accounts. Use **Account #0** as the **admin** (deployer) and **Account #1** as a **voter** for the demo.

In MetaMask: top-right avatar → **"Add account or hardware wallet"** → **"Import account"** → paste the private key.

| Role | Address | Private key |
|---|---|---|
| **Admin** (Account #0, deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Voter A** (Account #1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Voter B** (Account #2) | `0x3C44CdDdB6a900fA2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cddfb1f1` |
| **Voter C** (Account #3) | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |

> ⚠️ These keys are **publicly known**. Never send them real ETH. Never reuse this wallet on mainnet or any public testnet you care about. They exist purely for local Anvil work.

After importing, rename them in MetaMask (e.g. "Anvil Admin", "Anvil Voter A") so you don't mix them up while demoing.

### 7.4 Confirm the connection

1. Open http://localhost:5173.
2. Click **Connect wallet** in the navbar.
3. MetaMask pops up — pick **Anvil Admin**, approve.
4. The address badge in the navbar should show `0xf39F…2266` and a 10000 ETH balance (or close to it).

You're ready to demo.

---

## 8. End-to-end demo walkthrough

Run the autorun script (Step 5), set up MetaMask (Step 7), then:

1. **Navigate to `/admin`** — MetaMask connected as **Anvil Admin** (deployer = admin by default).
2. **Create an election**, e.g. *"Student Council 2026"*, with a thumbnail URL (any public image).
3. **Add 3 candidates** — each with a name, description, and image URL.
4. **Authorize voters** — paste the addresses of Voter A and Voter B (`0x7099…79C8`, `0x3C44…93BC`).
5. **Start the election** from the admin page.
6. **Switch MetaMask to Voter A** → go to `/vote` → pick the election → cast a vote. Approve the transaction. Switch to **Voter B**, repeat.
7. **Switch back to Anvil Admin** → `/admin` → **End election**.
8. **Visit `/results`** to see the winner and per-candidate tallies.

You can re-run the demo from scratch by stopping `dev.sh` (Ctrl-C) and running it again — Anvil resets every time.

---

## 9. Deploy to Sepolia testnet

For a public demo, deploy to the Sepolia testnet.

### 9.1 Pre-requisites

- A throwaway funded address with a few Sepolia ETH (faucets: https://sepoliafaucet.com, https://www.alchemy.com/faucets/ethereum-sepolia).
- A Sepolia RPC URL (Alchemy / Infura / public).
- Optional: an Etherscan API key for source verification.

### 9.2 Configure `contracts/.env`

```dotenv
PRIVATE_KEY=0xyour_throwaway_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
ETHERSCAN_API_KEY=your_etherscan_key   # optional
SEED_ADMINS=0xabc...,0xdef...          # optional extra admins
```

### 9.3 Deploy

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
cd ..

# Copy ABIs + new addresses into the frontend
bash scripts/sync-abi.sh --chain 11155111

# Commit the new addresses so teammates pick them up
git add frontend/src/contracts/addresses.json
git commit -m "chore: deploy to Sepolia"
```

### 9.4 Point the frontend at Sepolia

Set `frontend/.env`:

```dotenv
VITE_DEFAULT_CHAIN_ID=11155111
VITE_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/your_key   # optional
```

Restart `npm run dev` and switch MetaMask to **Sepolia**.

---

## 10. Testing

```bash
# All contract tests, verbose
npm run test:contracts
# or
cd contracts && forge test -vv
```

Filter by name:

```bash
cd contracts && forge test --match-test test_authorize_revertsIfNotAdmin -vvv
```

---

## 11. Project structure

```
.
├── contracts/                # Foundry workspace
│   ├── src/
│   │   ├── VoterRegistry.sol     # admin + voter role management
│   │   ├── Election.sol          # elections, candidates, votes
│   │   └── interfaces/
│   ├── script/Deploy.s.sol       # deploys both contracts
│   └── test/                     # forge tests
├── frontend/                 # Vite + React app
│   └── src/
│       ├── pages/                # AdminPage, ElectionList, ElectionDetail, Results
│       ├── components/           # Layout, ConnectButton, CandidateCard, Toasts, …
│       ├── hooks/                # wallet + contract hooks
│       ├── lib/wallet.js         # Ethers.js + MetaMask plumbing
│       ├── config/networks.js    # chain id → RPC + explorer
│       └── contracts/            # ABIs + addresses.json (synced from contracts/out)
├── scripts/
│   ├── dev.sh                    # autorun loop
│   └── sync-abi.sh               # copy ABIs + addresses to frontend
└── docs/superpowers/specs/       # design specs
```

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| MetaMask: "could not fetch chain ID" when adding Anvil | `anvil` isn't running. Start it (Step 5/6). |
| `Error: nonce too high` in MetaMask after restarting Anvil | Anvil was reset but MetaMask cached nonces. In MetaMask: Settings → Advanced → **Clear activity tab data**. |
| `Missing contracts/out — run 'forge build' first.` | Run `forge build` in `contracts/`, or use `npm run dev` which does it for you. |
| `jq: command not found` | Install jq (Step 2). |
| Frontend shows zero address (`0x0000…`) for contracts | `sync-abi.sh` couldn't find a broadcast file for the chain you targeted. Re-deploy and re-sync. |
| `Insufficient funds` on Sepolia | Top up the deployer with a faucet (Step 9.1). |
| Transactions stuck "pending" forever on Anvil | You restarted Anvil mid-session; reload the dApp and clear MetaMask activity (see above). |
| Voter can't vote — "not authorized" | Admin must add their address on the admin page **and** start the election before voting opens. |

---

## License & credits

Academic project (BTL Thực tập cơ sở). Built by the team listed in [docs/](docs/). Smart contracts use [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) (MIT) and [forge-std](https://github.com/foundry-rs/forge-std) (MIT/Apache-2.0).
