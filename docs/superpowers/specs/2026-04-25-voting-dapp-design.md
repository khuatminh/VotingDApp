# Voting DApp — Design Spec

**Date:** 2026-04-25
**Status:** Awaiting user review
**Scope:** Full scaffold of a decentralized voting DApp, base design + three agreed extensions (multi-admin RBAC, richer candidate info, multiple concurrent elections). Skeleton only — no business logic.

---

## 1. Purpose and context

A university capstone (BTL Thực tập cơ sở) Voting DApp on Ethereum, deployed to Sepolia for the demo. Built by a 3-person team: two developers who code in phases (both on backend first, then both on frontend), and one non-coder who owns the report and presentation. The contract layer must support parallel work for the two coders without merge conflicts, and the frontend layer must follow the same discipline.

This spec describes **what is built**, not **how to build it step by step** — the implementation plan will sequence the work.

## 2. Scope

### In scope
- Foundry + Solidity 0.8.24 backend with OpenZeppelin AccessControl.
- React + Vite + Ethers.js v6 + MetaMask frontend in JavaScript.
- Multi-admin role-based access control (symmetric admins, creator tracked per election — "Model 3").
- Multiple concurrent elections in a single deployed `Election` contract using nested mappings.
- Per-election voter authorization, stored in a dedicated `VoterRegistry` contract.
- Richer candidate info: `name`, `description`, `imageUrl` (plain HTTP URL string — no IPFS).
- Skeleton code with `TODO` comments. All revert bodies use `revert TODO();` or return zero-values.
- Root README documenting the dev workflow.

### Out of scope
- Business-logic implementation. Developers fill in function bodies during Phase 1/Phase 2.
- Upgradeability, proxies, Diamond pattern.
- Commit-reveal voting or on-chain privacy.
- TypeScript, TypeChain, subgraphs.
- A separate factory contract for elections (explicitly rejected in favor of nested mappings).
- Automated CI. The team deploys manually via `forge script`.

## 3. Architecture

### 3.1 High-level

```
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│ VoterRegistry.sol                      │◀──────│ Election.sol                            │
│   AccessControl (ADMIN_ROLE)           │  ref  │   AccessControl (ADMIN_ROLE)            │
│   (electionId, voter) → bool           │       │   mapping(uint => ElectionData)         │
│   authorize / revoke / isAuthorized    │       │   createElection, addCandidate, vote,   │
└────────────────────────────────────────┘       │   start/end, getResults, getWinner      │
                                                 └─────────────┬──────────────────────────┘
                                                               │
                                                               │  events + views
                                                               ▼
                                    ┌──────────────────────────────────────────────┐
                                    │ Frontend (React + Vite + Ethers v6)          │
                                    │   useWallet, useContract, ElectionSelector,  │
                                    │   AdminPage, VotePage, ResultsPage           │
                                    └──────────────────────────────────────────────┘
```

Two separately deployed contracts, linked at deploy time by passing `VoterRegistry`'s address into `Election`'s constructor. Each contract owns its own `AccessControl` roles; the deploy script grants `ADMIN_ROLE` to the same seed set on both, so the two role graphs stay in sync at genesis. Thereafter an "add admin" UI flow fires two `grantRole` transactions.

### 3.2 Why two contracts (Option A, composition)

- Zero merge conflicts during Phase 1: Dev A owns `VoterRegistry`, Dev B owns `Election`.
- Teaches inter-contract composition, a real-world pattern worth discussing in the report.
- Downside accepted: two deployments and two addresses tracked by the frontend.

### 3.3 Why nested mappings (not factory) for multiple elections

- Frontend has no subgraph or indexer. Tracking N dynamically-deployed child contracts via events is extra complexity.
- Demo uses 2–3 elections; per-election isolation gained from a factory is mostly theoretical at this scale.
- Keeps the two-contract split intact — `VoterRegistry` naturally extends to `(electionId, voter) → bool`.

### 3.4 Admin model ("Model 3")

- **Symmetric power:** every holder of `ADMIN_ROLE` can create elections, add candidates, authorize/revoke voters for any election, and start/end any election.
- **Creator tracked:** each `ElectionData` stores a `creator` field for auditability, surfaced in `getElection` and the frontend. Used only for display, never as an access check. Report can discuss this as a deliberate tradeoff vs. creator-owned elections.
- **Role graph:** each contract holds its own `DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE` sets. Any admin can grant/revoke both roles via OZ's built-in `grantRole` / `revokeRole`. Initial admins are seeded in each constructor.

## 4. Contract surface

### 4.1 `IVoterRegistry`

```solidity
interface IVoterRegistry {
    event VoterAuthorized(uint256 indexed electionId, address indexed voter, address indexed by);
    event VoterRevoked   (uint256 indexed electionId, address indexed voter, address indexed by);

    error NotAdmin();
    error AlreadyAuthorized();
    error NotAuthorized();
    error ZeroAddress();

    function authorizeVoter (uint256 electionId, address voter) external;
    function revokeVoter    (uint256 electionId, address voter) external;
    function authorizeVoters(uint256 electionId, address[] calldata voters) external; // reverts on first duplicate or zero address
    function isAuthorized   (uint256 electionId, address voter) external view returns (bool);
}
```

Role administration (`grantRole`, `revokeRole`, `hasRole`) is inherited from OpenZeppelin's `AccessControl` on the implementing contract and deliberately not in this interface.

### 4.2 `VoterRegistry`

- Inherits `AccessControl` and implements `IVoterRegistry`.
- Role constant: `bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE")`.
- Storage: `mapping(uint256 => mapping(address => bool)) private _authorized`.
- Constructor: `(address[] memory initialAdmins)` — grants `DEFAULT_ADMIN_ROLE` + `ADMIN_ROLE` to each. Reverts on empty list or zero address.
- Exposes `isAdmin(address) → bool` as a thin wrapper over `hasRole(ADMIN_ROLE, addr)` so the frontend has a single well-named call.

### 4.3 `Election`

- Inherits `AccessControl`. Holds a reference to `IVoterRegistry registry` stored immutably.
- Role constant: `bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE")`.
- Enum and structs:
  ```solidity
  enum State { NotStarted, Open, Ended }
  struct Candidate {
      uint256 id;
      string  name;
      string  description;
      string  imageUrl;   // plain HTTP(S) URL, no IPFS
      uint256 voteCount;
  }
  struct ElectionData {
      uint256 id;
      string  name;
      string  description;
      address creator;           // audit-only, never used for authz
      State   state;
      uint256 candidateCount;
      uint256 totalVotes;
      mapping(uint256 => Candidate)  candidates;  // id → Candidate
      mapping(address => bool)        hasVoted;   // voter → voted?
  }
  mapping(uint256 => ElectionData) private _elections;
  uint256 public electionCount;
  ```
- Functions (all take `electionId` where applicable; all admin-gated except `vote` and views):
  - `createElection(string name, string description) returns (uint256 electionId)` — `onlyRole(ADMIN_ROLE)`, emits `ElectionCreated`.
  - `addCandidate(uint256 electionId, string name, string description, string imageUrl) returns (uint256 candidateId)` — admin, state must be `NotStarted`.
  - `startElection(uint256 electionId)` — admin, transitions `NotStarted → Open`.
  - `endElection(uint256 electionId)` — admin, transitions `Open → Ended`.
  - `vote(uint256 electionId, uint256 candidateId)` — state must be `Open`, voter must be authorized via `registry.isAuthorized(electionId, msg.sender)`, must not have voted already.
  - Views: `getElection(uint256) → (id, name, description, creator, state, candidateCount, totalVotes)`, `getElectionCount()`, `getCandidate(uint256, uint256) → Candidate`, `getCandidateCount(uint256)`, `getResults(uint256) → Candidate[]`, `getWinner(uint256) → Candidate`. `getWinner` reverts with `ElectionNotEnded` if state != `Ended`, and with `NoVotesCast` if `totalVotes == 0`. Ties are broken by lowest `candidateId`.
  - `isAdmin(address) → bool` wrapper, same shape as `VoterRegistry`.
- Events: `ElectionCreated`, `CandidateAdded`, `ElectionStarted`, `VoteCast`, `ElectionEnded`.
- Errors: `ElectionNotFound`, `ElectionNotOpen`, `ElectionNotEnded`, `ElectionAlreadyStarted`, `ElectionAlreadyEnded`, `AlreadyVoted`, `VoterNotAuthorized`, `CandidateNotFound`, `NoCandidates`, `NoVotesCast`, `NotAdmin`, `EmptyName`.

### 4.4 Deploy script

`contracts/script/Deploy.s.sol`:
1. Read `PRIVATE_KEY` and optional `SEED_ADMINS` env vars.
2. Parse `SEED_ADMINS` (comma-separated) into an `address[]`; fall back to `[deployer]` if empty.
3. `new VoterRegistry(admins)` → address A.
4. `new Election(address(A), admins)` → address B.
5. Write both addresses and the current chainId to a JSON artifact (`broadcast/deploy-<chainId>.json` is fine; `sync-abi.sh` picks it up).

## 5. Frontend surface

### 5.1 Module map

- `src/config/networks.js` — chainId → `{ name, rpcUrl, explorerUrl }` for local (31337) and Sepolia (11155111).
- `src/contracts/addresses.json` — `{ "31337": { voterRegistry, election }, "11155111": { ... } }`. Committed; populated by `sync-abi.sh`.
- `src/contracts/VoterRegistry.json`, `Election.json` — ABIs. Gitignored; regenerated by `sync-abi.sh`.
- `src/lib/wallet.js` — MetaMask detection, `connect`, `getProvider`, `getSigner`, chain-switch helper.
- `src/hooks/useWallet.js` — exposes `{ address, chainId, isConnected, connect, disconnect }`.
- `src/hooks/useContract.js` — exposes `{ voterRegistry, election, isAdmin, ready }` (both `ethers.Contract` instances + role flag).
- `src/components/Layout.jsx`, `ConnectButton.jsx`, `ElectionSelector.jsx`, `CandidateCard.jsx`, `AddressBadge.jsx`.
- `src/pages/AdminPage.jsx`, `VotePage.jsx`, `ResultsPage.jsx`.
- `src/App.jsx` — routes: `/admin`, `/vote`, `/results`, default redirect to `/vote`.

### 5.2 AdminPage shape

Three sections on one page:
1. **Elections** — list of all elections with state badge, "Create election" form (name, description), per-row actions (add candidate, start, end).
2. **Voters** — election picker, address input, authorize/revoke buttons, batch authorize via textarea.
3. **Admin roles** — list of current `ADMIN_ROLE` holders (derived from `RoleGranted`/`RoleRevoked` event history since deploy), grant/revoke form. Grant/revoke fires two transactions (one per contract) and shows combined status.

### 5.3 VotePage shape

Election picker (only `Open` elections) → candidate grid using `CandidateCard` (image, name, description, current vote count) → vote button disabled if wallet not authorized for the selected election or already voted.

### 5.4 ResultsPage shape

Election picker (any state) → results view: winner highlighted if `Ended`, running totals shown if `Open`, "not started" placeholder if `NotStarted`.

## 6. Repository layout

```
Project/
├── contracts/
│   ├── src/
│   │   ├── VoterRegistry.sol                  # Dev A
│   │   ├── Election.sol                       # Dev B
│   │   └── interfaces/IVoterRegistry.sol      # agreed first, shared
│   ├── test/
│   │   ├── VoterRegistry.t.sol                # Dev A
│   │   └── Election.t.sol                     # Dev B (mocks registry)
│   ├── script/Deploy.s.sol                    # Dev B
│   ├── lib/                                   # forge-std, oz (gitignored)
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── .env.example
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── contracts/ (ABIs auto-synced, addresses.json committed)
│   │   ├── config/networks.js
│   │   ├── lib/wallet.js
│   │   ├── hooks/{useWallet,useContract}.js
│   │   ├── components/{Layout,ConnectButton,ElectionSelector,CandidateCard,AddressBadge}.jsx
│   │   ├── pages/{AdminPage,VotePage,ResultsPage}.jsx
│   │   ├── App.jsx, main.jsx, index.css
│   ├── index.html, vite.config.js, package.json, .env.example, .gitignore
├── scripts/
│   ├── sync-abi.sh
│   └── dev.sh
├── docs/superpowers/specs/
│   └── 2026-04-25-voting-dapp-design.md       # this file
├── package.json (root orchestration)
├── .gitignore
└── README.md
```

## 7. Coordination mechanics

- **`scripts/sync-abi.sh`** — `jq`-based shell script. Reads `contracts/out/VoterRegistry.sol/VoterRegistry.json` and `contracts/out/Election.sol/Election.json`, writes `{ abi }` slices to `frontend/src/contracts/`. Also parses the latest `contracts/broadcast/Deploy.s.sol/<chainId>/run-latest.json` to update `addresses.json` for that chain.
- **`scripts/dev.sh`** — starts `anvil` in the background, runs `forge build` + `forge script Deploy --broadcast --rpc-url local`, runs `sync-abi.sh`, then `cd frontend && npm run dev`.
- **`.env`** holds only secrets; addresses live in committed `addresses.json`.

## 8. Work split

### Phase 1 — Backend

| Step | Owner | Deliverable |
|---|---|---|
| 0 | Both | Finalize `IVoterRegistry.sol`, agree on `Election` event/error names, deploy-script shape. Commit. |
| 1 | Dev A | `VoterRegistry.sol` + `VoterRegistry.t.sol` (full AccessControl + auth flow). |
| 1 | Dev B | `Election.sol` + `Election.t.sol` (mocks `IVoterRegistry`) + `Deploy.s.sol` + `sync-abi.sh`. |
| 2 | Both | Integration test on anvil, deploy to Sepolia, commit `addresses.json`. |

### Phase 2 — Frontend

| Step | Owner | Deliverable |
|---|---|---|
| 0 | Both | Agree on `useContract` API and route layout. |
| 1 | Dev A | `wallet.js`, `useWallet`, `useContract`, `Layout`, `ConnectButton`, `App.jsx` routing, `AdminPage`. |
| 1 | Dev B | `ElectionSelector`, `CandidateCard`, `AddressBadge`, `VotePage`, `ResultsPage`. |
| 2 | Both | End-to-end demo on Sepolia. |

## 9. Success criteria

- All files described in section 6 exist as committed skeletons with `TODO(Dev A)` / `TODO(Dev B)` markers at every spot where business logic is expected.
- `forge build` would succeed once OpenZeppelin is installed (skeletons compile as-is, modulo the explicit `revert TODO()` placeholders).
- `npm run dev` in `frontend/` serves an app that renders layout + routes (no runtime errors), even before any contract call is wired.
- Root README documents: prerequisites, install steps, local dev loop, Sepolia deploy, demo script, file-ownership map.
- `docs/superpowers/specs/2026-04-25-voting-dapp-design.md` (this file) matches the as-built scaffold.

## 10. Open questions

- None. All four design questions were locked in the brainstorm: per-election auth, Model 3 admins, nested mappings, plain image URLs.
