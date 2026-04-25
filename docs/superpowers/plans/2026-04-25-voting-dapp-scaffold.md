# Voting DApp Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a monorepo for a decentralized voting DApp (Foundry + React/Vite) with multi-admin RBAC, per-election voter auth, richer candidates, and multiple concurrent elections. Skeletons only — every function body is `revert TODO();` or returns zero. Real business logic is filled in by Dev A and Dev B in later sessions.

**Architecture:** Two-contract composition (`VoterRegistry` + `Election`) using nested mappings for multi-election storage. OpenZeppelin `AccessControl` on each contract. JavaScript React + Vite + Ethers v6 frontend. Root orchestration scripts sync ABIs and run local dev.

**Tech Stack:** Solidity 0.8.24, Foundry (forge/anvil), OpenZeppelin Contracts v5, forge-std. React 18, Vite 5, React Router 6, Ethers.js 6. Bash + jq for ABI sync.

**Source of truth for file contents and semantics:** [`docs/superpowers/specs/2026-04-25-voting-dapp-design.md`](../specs/2026-04-25-voting-dapp-design.md). When in doubt, the spec wins.

**Project root:** `/Users/justminh/Desktop/DH/BTL_TTCS/Project`. All paths below are relative to it unless noted.

**Working-directory assumption:** Every `Run:` command is executed from the project root, unless the command itself begins with `cd`.

---

## File structure produced by this plan

```
Project/
├── .git/                                       # initialized in Task 1
├── .gitignore                                  # Task 1
├── package.json                                # Task 1
├── README.md                                   # Task 15
├── docs/superpowers/
│   ├── specs/2026-04-25-voting-dapp-design.md  # already exists (pre-plan)
│   └── plans/2026-04-25-voting-dapp-scaffold.md # this file (pre-plan)
├── contracts/                                  # Task 2
│   ├── foundry.toml                            # Task 2
│   ├── remappings.txt                          # Task 2
│   ├── .env.example                            # Task 2
│   ├── .gitignore                              # Task 2
│   ├── lib/forge-std, lib/openzeppelin-contracts # Task 2 (gitignored)
│   ├── src/
│   │   ├── interfaces/IVoterRegistry.sol       # Task 3
│   │   ├── VoterRegistry.sol                   # Task 4
│   │   └── Election.sol                        # Task 5
│   ├── test/
│   │   ├── VoterRegistry.t.sol                 # Task 6
│   │   └── Election.t.sol                      # Task 6
│   └── script/Deploy.s.sol                     # Task 7
├── frontend/                                   # Tasks 8–13
│   ├── package.json, vite.config.js, index.html, .env.example, .gitignore
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── config/networks.js
│       ├── contracts/addresses.json, .gitignore
│       ├── lib/wallet.js
│       ├── hooks/useWallet.js, hooks/useContract.js
│       ├── components/{Layout,ConnectButton,ElectionSelector,CandidateCard,AddressBadge}.jsx
│       └── pages/{AdminPage,VotePage,ResultsPage}.jsx
└── scripts/
    ├── sync-abi.sh                             # Task 14
    └── dev.sh                                  # Task 14
```

Each file has one responsibility — skeleton for one contract, one hook, one component, one page. Files that change together (e.g., both hooks, all pages) are written in the same task.

---

## Task 1: Initialize git and root orchestration files

**Files:**
- Create: `.gitignore`
- Create: `package.json`

- [ ] **Step 1: Init git and stage the pre-existing spec + plan**

Run:
```bash
git init -b main
git config user.email "$(git config --global user.email || echo 'dev@local')"
git config user.name "$(git config --global user.name || echo 'Dev')"
```
Expected: `Initialized empty Git repository in …/Project/.git/`

- [ ] **Step 2: Write root `.gitignore`**

Create `.gitignore`:
```gitignore
# OS
.DS_Store
Thumbs.db

# Editors
.vscode/
.idea/

# Env
.env
.env.*
!.env.example

# Node
node_modules/

# Foundry artifacts (contracts/.gitignore covers the rest)
**/cache/
**/out/
**/broadcast/
!contracts/broadcast/.gitkeep

# Frontend ABIs are auto-synced; only addresses.json is committed
frontend/src/contracts/*.json
!frontend/src/contracts/addresses.json
```

- [ ] **Step 3: Write root `package.json`**

Create `package.json`:
```json
{
  "name": "voting-dapp",
  "version": "0.1.0",
  "private": true,
  "description": "Decentralized voting DApp (academic). Foundry + React/Vite monorepo.",
  "scripts": {
    "build:contracts": "cd contracts && forge build",
    "test:contracts": "cd contracts && forge test -vv",
    "sync-abi": "bash scripts/sync-abi.sh",
    "dev": "bash scripts/dev.sh",
    "frontend:dev": "cd frontend && npm run dev",
    "frontend:build": "cd frontend && npm run build",
    "install:all": "cd frontend && npm install"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add .gitignore package.json docs/
git commit -m "chore: init repo with spec, plan, and root config"
```
Expected: new commit, working tree clean except untracked files yet to come.

---

## Task 2: Initialize Foundry workspace + install dependencies

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/remappings.txt`
- Create: `contracts/.env.example`
- Create: `contracts/.gitignore`

Prerequisite: `forge --version` must print a version. If not, install Foundry via `curl -L https://foundry.paradigm.xyz | bash && foundryup`.

- [ ] **Step 1: Create contracts directory layout**

Run:
```bash
mkdir -p contracts/src/interfaces contracts/test contracts/script contracts/lib
```

- [ ] **Step 2: Write `contracts/foundry.toml`**

Create `contracts/foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = false
extra_output = ["abi"]

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
local = "http://127.0.0.1:8545"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
```

- [ ] **Step 3: Write `contracts/remappings.txt`**

Create `contracts/remappings.txt`:
```
forge-std/=lib/forge-std/src/
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
```

- [ ] **Step 4: Write `contracts/.env.example`**

Create `contracts/.env.example`:
```bash
# Copy to .env (gitignored). Never commit real keys.

# Deployer private key (use a throwaway account)
PRIVATE_KEY=

# Sepolia RPC endpoint — Alchemy / Infura / public
SEPOLIA_RPC_URL=

# Optional — used by `forge verify-contract`
ETHERSCAN_API_KEY=

# Comma-separated seed admin addresses granted ADMIN_ROLE at deploy.
# Leave blank to grant only the deployer. Example:
# SEED_ADMINS=0xabc...,0xdef...
SEED_ADMINS=
```

- [ ] **Step 5: Write `contracts/.gitignore`**

Create `contracts/.gitignore`:
```gitignore
cache/
out/
broadcast/
lib/
.env
.env.*
!.env.example
```

- [ ] **Step 6: Install Foundry libraries**

Run from project root:
```bash
cd contracts && forge install foundry-rs/forge-std --no-commit && forge install OpenZeppelin/openzeppelin-contracts --no-commit && cd ..
```
Expected: `lib/forge-std` and `lib/openzeppelin-contracts` populated. No top-level git commit created (we control commits manually).

- [ ] **Step 7: Sanity build (empty project compiles)**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: `Compiler run successful!` (0 contracts compiled — `src/` is still empty).

- [ ] **Step 8: Commit**

Run:
```bash
git add contracts/foundry.toml contracts/remappings.txt contracts/.env.example contracts/.gitignore
git commit -m "chore(contracts): init foundry workspace with OZ v5 + forge-std"
```

---

## Task 3: Write `IVoterRegistry` interface

**Files:**
- Create: `contracts/src/interfaces/IVoterRegistry.sol`

- [ ] **Step 1: Write the interface**

Create `contracts/src/interfaces/IVoterRegistry.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVoterRegistry
/// @notice Per-election voter authorization surface consumed by Election.sol.
/// @dev Agreed by Dev A + Dev B before parallel implementation. See spec §4.1.
interface IVoterRegistry {
    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event VoterAuthorized(uint256 indexed electionId, address indexed voter, address indexed by);
    event VoterRevoked(uint256 indexed electionId, address indexed voter, address indexed by);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotAdmin();
    error AlreadyAuthorized();
    error NotAuthorized();
    error ZeroAddress();

    // ---------------------------------------------------------------------
    // Admin-only: voter management, scoped per election
    // ---------------------------------------------------------------------

    /// @notice Authorize `voter` for `electionId`. Caller must hold ADMIN_ROLE.
    function authorizeVoter(uint256 electionId, address voter) external;

    /// @notice Revoke `voter`'s authorization for `electionId`. Caller must hold ADMIN_ROLE.
    function revokeVoter(uint256 electionId, address voter) external;

    /// @notice Batch authorize. Reverts on the first duplicate or zero address; no partial success.
    function authorizeVoters(uint256 electionId, address[] calldata voters) external;

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Returns true if `voter` is currently authorized for `electionId`.
    function isAuthorized(uint256 electionId, address voter) external view returns (bool);
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: `Compiler run successful!` with 1 file compiled.

- [ ] **Step 3: Commit**

Run:
```bash
git add contracts/src/interfaces/IVoterRegistry.sol
git commit -m "feat(contracts): add IVoterRegistry interface"
```

---

## Task 4: Write `VoterRegistry` skeleton

**Files:**
- Create: `contracts/src/VoterRegistry.sol`

- [ ] **Step 1: Write the skeleton**

Create `contracts/src/VoterRegistry.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IVoterRegistry} from "./interfaces/IVoterRegistry.sol";

/// @title VoterRegistry
/// @author Dev A
/// @notice Per-election voter authorization, guarded by role-based access control.
/// @dev SKELETON. Every function body either reverts `TODO()` or returns a zero value.
///      Spec: docs/superpowers/specs/2026-04-25-voting-dapp-design.md §4.2
contract VoterRegistry is IVoterRegistry, AccessControl {
    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------

    /// @notice Role granted to every admin. Members may authorize/revoke voters for any election.
    /// @dev keccak256("ADMIN_ROLE")
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    // TODO(Dev A): (electionId => (voter => authorized?))
    // mapping(uint256 => mapping(address => bool)) private _authorized;

    // ---------------------------------------------------------------------
    // Skeleton sentinel
    // ---------------------------------------------------------------------

    /// @dev Placeholder error used by unimplemented skeletons. Remove when filling in.
    error TODO();

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param initialAdmins Addresses seeded with DEFAULT_ADMIN_ROLE + ADMIN_ROLE.
    ///        Must be non-empty; every element must be non-zero. See spec §4.2.
    constructor(address[] memory initialAdmins) {
        // TODO(Dev A):
        //   1. require initialAdmins.length > 0
        //   2. for each admin:
        //      - revert ZeroAddress() if admin == address(0)
        //      - _grantRole(DEFAULT_ADMIN_ROLE, admin)
        //      - _grantRole(ADMIN_ROLE, admin)
        initialAdmins; // silence unused-var warning in skeleton
    }

    // ---------------------------------------------------------------------
    // External — voter authorization (per election)
    // ---------------------------------------------------------------------

    /// @inheritdoc IVoterRegistry
    function authorizeVoter(uint256 electionId, address voter)
        external
        /* onlyRole(ADMIN_ROLE) */
    {
        // TODO(Dev A):
        //   - require msg.sender has ADMIN_ROLE (use onlyRole or revert NotAdmin)
        //   - require voter != address(0) (ZeroAddress)
        //   - require !_authorized[electionId][voter] (AlreadyAuthorized)
        //   - set _authorized[electionId][voter] = true
        //   - emit VoterAuthorized(electionId, voter, msg.sender)
        electionId; voter;
        revert TODO();
    }

    /// @inheritdoc IVoterRegistry
    function revokeVoter(uint256 electionId, address voter)
        external
        /* onlyRole(ADMIN_ROLE) */
    {
        // TODO(Dev A): mirror of authorizeVoter; require currently authorized, emit VoterRevoked.
        electionId; voter;
        revert TODO();
    }

    /// @inheritdoc IVoterRegistry
    function authorizeVoters(uint256 electionId, address[] calldata voters)
        external
        /* onlyRole(ADMIN_ROLE) */
    {
        // TODO(Dev A): loop over voters; revert on first ZeroAddress or AlreadyAuthorized.
        electionId; voters;
        revert TODO();
    }

    // ---------------------------------------------------------------------
    // External — views
    // ---------------------------------------------------------------------

    /// @inheritdoc IVoterRegistry
    function isAuthorized(uint256 electionId, address voter) external view returns (bool) {
        // TODO(Dev A): return _authorized[electionId][voter];
        electionId; voter;
        return false;
    }

    // ---------------------------------------------------------------------
    // Admin-role helpers (thin wrapper for frontend convenience)
    // ---------------------------------------------------------------------

    /// @notice Returns true if `account` currently holds ADMIN_ROLE.
    /// @dev Thin wrapper over AccessControl.hasRole so the frontend can call one well-named view.
    function isAdmin(address account) external view returns (bool) {
        // TODO(Dev A): return hasRole(ADMIN_ROLE, account);
        account;
        return false;
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: `Compiler run successful!` with OpenZeppelin + VoterRegistry compiled. Warnings about unused variables are acceptable in the skeleton.

- [ ] **Step 3: Commit**

Run:
```bash
git add contracts/src/VoterRegistry.sol
git commit -m "feat(contracts): add VoterRegistry skeleton (Dev A)"
```

---

## Task 5: Write `Election` skeleton

**Files:**
- Create: `contracts/src/Election.sol`

- [ ] **Step 1: Write the skeleton**

Create `contracts/src/Election.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IVoterRegistry} from "./interfaces/IVoterRegistry.sol";

/// @title Election
/// @author Dev B
/// @notice Manages multiple concurrent elections with richer candidates and per-election
///         voter authorization (delegated to IVoterRegistry). Symmetric admins; creator
///         tracked for auditing only ("Model 3" — see spec §3.4).
/// @dev SKELETON. All mutating bodies revert `TODO()`; all views return zero/empty.
///      Spec: docs/superpowers/specs/2026-04-25-voting-dapp-design.md §4.3
contract Election is AccessControl {
    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------

    /// @dev keccak256("ADMIN_ROLE")
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum State { NotStarted, Open, Ended }

    struct Candidate {
        uint256 id;
        string  name;
        string  description;
        string  imageUrl;
        uint256 voteCount;
    }

    struct ElectionData {
        uint256 id;
        string  name;
        string  description;
        address creator;        // audit-only, never used for authz
        State   state;
        uint256 candidateCount;
        uint256 totalVotes;
        mapping(uint256 => Candidate) candidates;
        mapping(address => bool)       hasVoted;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice External voter-authorization source. Immutable after deploy.
    IVoterRegistry public immutable registry;

    /// @notice Number of elections ever created. Also used as the next election id.
    uint256 public electionCount;

    // TODO(Dev B): mapping(uint256 => ElectionData) private _elections;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ElectionCreated(uint256 indexed electionId, address indexed creator, string name);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error TODO();              // skeleton sentinel
    error NotAdmin();
    error ElectionNotFound();
    error ElectionNotOpen();
    error ElectionNotEnded();
    error ElectionAlreadyStarted();
    error ElectionAlreadyEnded();
    error AlreadyVoted();
    error VoterNotAuthorized();
    error CandidateNotFound();
    error NoCandidates();
    error NoVotesCast();
    error EmptyName();

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param registryAddress Deployed VoterRegistry address.
    /// @param initialAdmins   Seeded with DEFAULT_ADMIN_ROLE + ADMIN_ROLE. Must be non-empty.
    constructor(address registryAddress, address[] memory initialAdmins) {
        // TODO(Dev B):
        //   1. require registryAddress != address(0)
        //   2. registry = IVoterRegistry(registryAddress);  // note: immutable, must set here
        //   3. require initialAdmins.length > 0
        //   4. for each admin: _grantRole(DEFAULT_ADMIN_ROLE, admin) and _grantRole(ADMIN_ROLE, admin)
        registry = IVoterRegistry(registryAddress);
        initialAdmins;
    }

    // ---------------------------------------------------------------------
    // Admin — election lifecycle
    // ---------------------------------------------------------------------

    /// @notice Create a new election. Returns the new election id (also `electionCount - 1`).
    function createElection(string calldata name, string calldata description)
        external
        /* onlyRole(ADMIN_ROLE) */
        returns (uint256 electionId)
    {
        // TODO(Dev B):
        //   - require bytes(name).length > 0 (EmptyName)
        //   - electionId = electionCount++;
        //   - init _elections[electionId] fields (id, name, description, creator=msg.sender, state=NotStarted)
        //   - emit ElectionCreated
        name; description;
        revert TODO();
    }

    function addCandidate(
        uint256 electionId,
        string calldata name,
        string calldata description,
        string calldata imageUrl
    ) external /* onlyRole(ADMIN_ROLE) */ returns (uint256 candidateId) {
        // TODO(Dev B):
        //   - require election exists and state == NotStarted
        //   - require bytes(name).length > 0
        //   - candidateId = e.candidateCount++;
        //   - store Candidate, emit CandidateAdded
        electionId; name; description; imageUrl;
        revert TODO();
    }

    function startElection(uint256 electionId) external /* onlyRole(ADMIN_ROLE) */ {
        // TODO(Dev B): require state == NotStarted; require candidateCount > 0 (NoCandidates); set Open; emit.
        electionId;
        revert TODO();
    }

    function endElection(uint256 electionId) external /* onlyRole(ADMIN_ROLE) */ {
        // TODO(Dev B): require state == Open; set Ended; emit.
        electionId;
        revert TODO();
    }

    // ---------------------------------------------------------------------
    // Public — cast a vote
    // ---------------------------------------------------------------------

    function vote(uint256 electionId, uint256 candidateId) external {
        // TODO(Dev B):
        //   - require election exists and state == Open (ElectionNotOpen)
        //   - require registry.isAuthorized(electionId, msg.sender) (VoterNotAuthorized)
        //   - require !e.hasVoted[msg.sender] (AlreadyVoted)
        //   - require candidateId < e.candidateCount (CandidateNotFound)
        //   - e.hasVoted[msg.sender] = true;
        //   - e.candidates[candidateId].voteCount++;
        //   - e.totalVotes++;
        //   - emit VoteCast
        electionId; candidateId;
        revert TODO();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getElection(uint256 electionId)
        external
        view
        returns (
            uint256 id,
            string memory name,
            string memory description,
            address creator,
            State state,
            uint256 candidateCount,
            uint256 totalVotes
        )
    {
        // TODO(Dev B): destructure _elections[electionId]; revert ElectionNotFound if id >= electionCount.
        electionId;
        return (0, "", "", address(0), State.NotStarted, 0, 0);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        returns (Candidate memory)
    {
        // TODO(Dev B): bounds-check, return e.candidates[candidateId].
        electionId; candidateId;
        return Candidate(0, "", "", "", 0);
    }

    function getCandidateCount(uint256 electionId) external view returns (uint256) {
        // TODO(Dev B): bounds-check, return e.candidateCount.
        electionId;
        return 0;
    }

    function getResults(uint256 electionId) external view returns (Candidate[] memory) {
        // TODO(Dev B): return all candidates for the election.
        electionId;
        return new Candidate[](0);
    }

    /// @notice Winner is the candidate with the highest voteCount. Ties broken by lowest candidateId.
    /// @dev Reverts ElectionNotEnded if state != Ended; reverts NoVotesCast if totalVotes == 0.
    function getWinner(uint256 electionId) external view returns (Candidate memory) {
        // TODO(Dev B): enforce state & totalVotes checks, then linear scan with tiebreak = lowest id.
        electionId;
        return Candidate(0, "", "", "", 0);
    }

    /// @notice Returns true if `account` holds ADMIN_ROLE.
    function isAdmin(address account) external view returns (bool) {
        // TODO(Dev B): return hasRole(ADMIN_ROLE, account);
        account;
        return false;
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: `Compiler run successful!`. Warnings about unused variables and the skeleton's missing mapping are acceptable.

- [ ] **Step 3: Commit**

Run:
```bash
git add contracts/src/Election.sol
git commit -m "feat(contracts): add Election skeleton (Dev B)"
```

---

## Task 6: Write test skeletons

**Files:**
- Create: `contracts/test/VoterRegistry.t.sol`
- Create: `contracts/test/Election.t.sol`

These are compile-clean skeletons. Every test function body is empty except for a one-line comment referencing the behavior to verify. Dev A and Dev B fill them in during Phase 1.

- [ ] **Step 1: Write `VoterRegistry.t.sol`**

Create `contracts/test/VoterRegistry.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VoterRegistry} from "../src/VoterRegistry.sol";
import {IVoterRegistry} from "../src/interfaces/IVoterRegistry.sol";

/// @title VoterRegistry unit tests (skeleton)
/// @author Dev A
/// @dev Every `test_*` is a TODO. Fill bodies per spec §4.2 behaviors.
contract VoterRegistryTest is Test {
    VoterRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal other = makeAddr("other");
    address internal voter = makeAddr("voter");

    uint256 internal constant ELECTION_ID = 0;

    function setUp() public {
        // TODO(Dev A): deploy VoterRegistry with `admin` as sole initial admin.
        address[] memory admins = new address[](1);
        admins[0] = admin;
        registry = new VoterRegistry(admins);
    }

    // ----- constructor ---------------------------------------------------

    function test_constructor_revertsOnEmptyAdminList() public { /* TODO(Dev A) */ }
    function test_constructor_revertsOnZeroAdmin()     public { /* TODO(Dev A) */ }
    function test_constructor_grantsRolesToSeedAdmins() public { /* TODO(Dev A) */ }

    // ----- authorizeVoter ------------------------------------------------

    function test_authorizeVoter_happyPath()           public { /* TODO(Dev A): admin calls, isAuthorized true, event */ }
    function test_authorizeVoter_revertsWhenNonAdmin() public { /* TODO(Dev A) */ }
    function test_authorizeVoter_revertsOnZeroAddress() public { /* TODO(Dev A) */ }
    function test_authorizeVoter_revertsWhenAlreadyAuthorized() public { /* TODO(Dev A) */ }

    // ----- revokeVoter ---------------------------------------------------

    function test_revokeVoter_happyPath()             public { /* TODO(Dev A) */ }
    function test_revokeVoter_revertsWhenNotAuthorized() public { /* TODO(Dev A) */ }

    // ----- authorizeVoters (batch) --------------------------------------

    function test_authorizeVoters_happyPath()         public { /* TODO(Dev A) */ }
    function test_authorizeVoters_revertsOnFirstZeroAddress()    public { /* TODO(Dev A) */ }
    function test_authorizeVoters_revertsOnFirstDuplicate()      public { /* TODO(Dev A) */ }

    // ----- role administration (inherited from AccessControl) ----------

    function test_grantRole_byDefaultAdmin()          public { /* TODO(Dev A): new admin gains ADMIN_ROLE */ }
    function test_revokeRole_byDefaultAdmin()         public { /* TODO(Dev A) */ }
    function test_isAdmin_reflectsRoleState()         public { /* TODO(Dev A) */ }

    // ----- per-election isolation ---------------------------------------

    function test_isAuthorized_isPerElection()        public { /* TODO(Dev A): authorize for 0, not 1 */ }
}
```

- [ ] **Step 2: Write `Election.t.sol`**

Create `contracts/test/Election.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Election} from "../src/Election.sol";
import {IVoterRegistry} from "../src/interfaces/IVoterRegistry.sol";

/// @dev Minimal mock of IVoterRegistry so Election tests are independent of VoterRegistry impl.
///      Dev B may enrich this mock as needed — just keep it local to this file.
contract MockVoterRegistry is IVoterRegistry {
    mapping(uint256 => mapping(address => bool)) public auth;

    function setAuthorized(uint256 electionId, address voter, bool yes) external {
        auth[electionId][voter] = yes;
    }

    function authorizeVoter(uint256 electionId, address voter) external  { auth[electionId][voter] = true; }
    function revokeVoter(uint256 electionId, address voter) external     { auth[electionId][voter] = false; }
    function authorizeVoters(uint256 electionId, address[] calldata voters) external {
        for (uint256 i; i < voters.length; ++i) auth[electionId][voters[i]] = true;
    }
    function isAuthorized(uint256 electionId, address voter) external view returns (bool) {
        return auth[electionId][voter];
    }
}

/// @title Election unit tests (skeleton)
/// @author Dev B
/// @dev Every `test_*` is a TODO. Fill bodies per spec §4.3 behaviors.
contract ElectionTest is Test {
    Election        internal election;
    MockVoterRegistry internal registry;

    address internal admin   = makeAddr("admin");
    address internal other   = makeAddr("other");
    address internal voter1  = makeAddr("voter1");
    address internal voter2  = makeAddr("voter2");

    function setUp() public {
        registry = new MockVoterRegistry();
        address[] memory admins = new address[](1);
        admins[0] = admin;
        election = new Election(address(registry), admins);
    }

    // ----- constructor ---------------------------------------------------

    function test_constructor_setsRegistryImmutable()     public { /* TODO(Dev B) */ }
    function test_constructor_revertsOnZeroRegistry()     public { /* TODO(Dev B) */ }
    function test_constructor_revertsOnEmptyAdminList()   public { /* TODO(Dev B) */ }
    function test_constructor_grantsRolesToSeedAdmins()   public { /* TODO(Dev B) */ }

    // ----- createElection -----------------------------------------------

    function test_createElection_happyPath()              public { /* TODO(Dev B): id, creator, state, event */ }
    function test_createElection_revertsOnEmptyName()     public { /* TODO(Dev B) */ }
    function test_createElection_revertsWhenNonAdmin()    public { /* TODO(Dev B) */ }
    function test_createElection_incrementsElectionCount() public { /* TODO(Dev B) */ }

    // ----- addCandidate --------------------------------------------------

    function test_addCandidate_happyPath()                public { /* TODO(Dev B) */ }
    function test_addCandidate_revertsWhenStarted()       public { /* TODO(Dev B) */ }
    function test_addCandidate_revertsWhenNonAdmin()      public { /* TODO(Dev B) */ }
    function test_addCandidate_revertsOnEmptyName()       public { /* TODO(Dev B) */ }

    // ----- lifecycle -----------------------------------------------------

    function test_startElection_happyPath()               public { /* TODO(Dev B) */ }
    function test_startElection_revertsWithoutCandidates() public { /* TODO(Dev B): NoCandidates */ }
    function test_startElection_revertsWhenAlreadyStarted() public { /* TODO(Dev B) */ }
    function test_endElection_happyPath()                 public { /* TODO(Dev B) */ }
    function test_endElection_revertsWhenNotOpen()        public { /* TODO(Dev B) */ }

    // ----- vote ----------------------------------------------------------

    function test_vote_happyPath()                        public { /* TODO(Dev B): increments counts, emits event */ }
    function test_vote_revertsWhenNotOpen()               public { /* TODO(Dev B) */ }
    function test_vote_revertsWhenNotAuthorized()         public { /* TODO(Dev B) */ }
    function test_vote_revertsWhenAlreadyVoted()          public { /* TODO(Dev B) */ }
    function test_vote_revertsOnUnknownCandidate()        public { /* TODO(Dev B) */ }

    // ----- views ---------------------------------------------------------

    function test_getResults_returnsAllCandidates()       public { /* TODO(Dev B) */ }
    function test_getWinner_revertsWhenNotEnded()         public { /* TODO(Dev B): ElectionNotEnded */ }
    function test_getWinner_revertsOnNoVotes()            public { /* TODO(Dev B): NoVotesCast */ }
    function test_getWinner_tiebreakByLowestId()          public { /* TODO(Dev B) */ }

    // ----- concurrent elections -----------------------------------------

    function test_multipleElections_isolatedState()       public { /* TODO(Dev B): vote in 0 ≠ vote in 1 */ }
}
```

- [ ] **Step 3: Verify everything compiles**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: `Compiler run successful!`. Tests compile as no-ops.

- [ ] **Step 4: Verify tests run (all pass as empty)**

Run:
```bash
cd contracts && forge test -vv && cd ..
```
Expected: 43 tests total (16 in `VoterRegistryTest`, 27 in `ElectionTest`) all pass. They pass trivially because the bodies are empty — an empty test function is a passing test in Foundry.

- [ ] **Step 5: Commit**

Run:
```bash
git add contracts/test/VoterRegistry.t.sol contracts/test/Election.t.sol
git commit -m "test(contracts): add test skeletons for VoterRegistry and Election"
```

---

## Task 7: Write deploy script skeleton

**Files:**
- Create: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Write the script**

Create `contracts/script/Deploy.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VoterRegistry} from "../src/VoterRegistry.sol";
import {Election}      from "../src/Election.sol";

/// @title Deploy
/// @notice Deploys VoterRegistry and Election with a shared initial-admin set.
/// @dev SKELETON. Parses PRIVATE_KEY + optional SEED_ADMINS env vars. Spec §4.4.
contract Deploy is Script {
    function run() external returns (VoterRegistry registry, Election election) {
        // TODO(Dev B):
        //   1. uint256 pk = vm.envUint("PRIVATE_KEY");
        //   2. address deployer = vm.addr(pk);
        //   3. address[] memory admins = _parseSeedAdmins(deployer);
        //   4. vm.startBroadcast(pk);
        //        registry = new VoterRegistry(admins);
        //        election = new Election(address(registry), admins);
        //      vm.stopBroadcast();
        //   5. console2.log("VoterRegistry:", address(registry));
        //   6. console2.log("Election:",      address(election));
        return (VoterRegistry(address(0)), Election(address(0)));
    }

    /// @dev Parses `SEED_ADMINS` (comma-separated). Falls back to [deployer] if unset/empty.
    function _parseSeedAdmins(address deployer) internal view returns (address[] memory admins) {
        // TODO(Dev B):
        //   - try vm.envString("SEED_ADMINS"); on empty/not-set -> return [deployer]
        //   - split on ","; parse each with vm.parseAddress; trim whitespace
        //   - return the resulting array
        deployer;
        admins = new address[](0);
    }
}
```

- [ ] **Step 2: Verify compile**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: success.

- [ ] **Step 3: Commit**

Run:
```bash
git add contracts/script/Deploy.s.sol
git commit -m "feat(contracts): add Deploy script skeleton"
```

---

## Task 8: Initialize Vite + React frontend workspace

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore`

- [ ] **Step 1: Make directory tree**

Run:
```bash
mkdir -p frontend/src/config frontend/src/contracts frontend/src/lib frontend/src/hooks frontend/src/components frontend/src/pages
```

- [ ] **Step 2: Write `frontend/package.json`**

Create `frontend/package.json`:
```json
{
  "name": "voting-dapp-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "ethers": "^6.13.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 3: Write `frontend/vite.config.js`**

Create `frontend/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Write `frontend/index.html`**

Create `frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voting DApp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `frontend/.env.example`**

Create `frontend/.env.example`:
```bash
# Copy to .env (gitignored). Vite exposes VITE_* vars to the client.

# Default chain the app targets on first load (11155111 = Sepolia, 31337 = Anvil)
VITE_DEFAULT_CHAIN_ID=31337

# Optional override RPC URLs (falls back to MetaMask's provider if blank)
VITE_SEPOLIA_RPC=
```

- [ ] **Step 6: Write `frontend/.gitignore`**

Create `frontend/.gitignore`:
```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
```

- [ ] **Step 7: Install frontend dependencies**

Run:
```bash
cd frontend && npm install && cd ..
```
Expected: `node_modules/` populated, `package-lock.json` created. No errors.

- [ ] **Step 8: Commit (without node_modules/lock)**

Run:
```bash
git add frontend/package.json frontend/vite.config.js frontend/index.html frontend/.env.example frontend/.gitignore frontend/package-lock.json
git commit -m "chore(frontend): init vite + react + ethers + react-router workspace"
```

---

## Task 9: Write frontend config + contracts placeholder

**Files:**
- Create: `frontend/src/config/networks.js`
- Create: `frontend/src/contracts/addresses.json`
- Create: `frontend/src/contracts/.gitignore`

- [ ] **Step 1: Write `networks.js`**

Create `frontend/src/config/networks.js`:
```js
// Chain configuration. Keep in sync with deploy targets.
export const NETWORKS = {
  31337: {
    name: 'Anvil (local)',
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: null,
  },
  11155111: {
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC || null,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
};

export const DEFAULT_CHAIN_ID = Number(
  import.meta.env.VITE_DEFAULT_CHAIN_ID || 31337
);

export const SUPPORTED_CHAIN_IDS = Object.keys(NETWORKS).map(Number);
```

- [ ] **Step 2: Write `addresses.json` (placeholder — populated by sync-abi.sh)**

Create `frontend/src/contracts/addresses.json`:
```json
{
  "31337": {
    "voterRegistry": "0x0000000000000000000000000000000000000000",
    "election":       "0x0000000000000000000000000000000000000000"
  },
  "11155111": {
    "voterRegistry": "0x0000000000000000000000000000000000000000",
    "election":       "0x0000000000000000000000000000000000000000"
  }
}
```

- [ ] **Step 3: Write `frontend/src/contracts/.gitignore`**

Create `frontend/src/contracts/.gitignore`:
```gitignore
# ABI JSON files are auto-synced from contracts/out by scripts/sync-abi.sh.
# Only addresses.json is committed.
*.json
!addresses.json
!.gitignore
```

- [ ] **Step 4: Commit**

Run:
```bash
git add frontend/src/config/networks.js frontend/src/contracts/addresses.json frontend/src/contracts/.gitignore
git commit -m "chore(frontend): add network config and addresses placeholder"
```

---

## Task 10: Write wallet lib and Web3 hooks

**Files:**
- Create: `frontend/src/lib/wallet.js`
- Create: `frontend/src/hooks/useWallet.js`
- Create: `frontend/src/hooks/useContract.js`

- [ ] **Step 1: Write `wallet.js`**

Create `frontend/src/lib/wallet.js`:
```js
// Low-level MetaMask helpers. No React here — pure functions.
// Spec §5.1. All function bodies are TODOs; signatures are the stable interface.

import { BrowserProvider } from 'ethers';

/** Returns true if window.ethereum is present. */
export function hasMetaMask() {
  // TODO(Dev A): return typeof window !== 'undefined' && !!window.ethereum;
  return false;
}

/** Returns a new ethers BrowserProvider bound to window.ethereum, or null. */
export function getProvider() {
  // TODO(Dev A): if (!hasMetaMask()) return null; return new BrowserProvider(window.ethereum);
  return null;
}

/** Requests account access and returns the checksummed signer address. */
export async function connect() {
  // TODO(Dev A):
  //   - const provider = getProvider();
  //   - if (!provider) throw new Error('MetaMask not installed');
  //   - await provider.send('eth_requestAccounts', []);
  //   - const signer = await provider.getSigner();
  //   - return await signer.getAddress();
  throw new Error('TODO: implement connect()');
}

/** Returns the currently-connected signer, or null if not connected. */
export async function getSigner() {
  // TODO(Dev A): try provider.getSigner() and return; if user not connected, return null.
  return null;
}

/** Returns the current chainId (number), or null. */
export async function getChainId() {
  // TODO(Dev A): const net = await provider.getNetwork(); return Number(net.chainId);
  return null;
}

/** Programmatic chain switch. Falls back to wallet_addEthereumChain on code 4902. */
export async function switchChain(chainIdHex) {
  // TODO(Dev A): window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  chainIdHex;
  throw new Error('TODO: implement switchChain()');
}

/**
 * Register listeners for accountsChanged + chainChanged.
 * Returns an unsubscribe function.
 */
export function onAccountOrChainChange(handler) {
  // TODO(Dev A):
  //   - window.ethereum.on('accountsChanged', handler);
  //   - window.ethereum.on('chainChanged',     handler);
  //   - return () => { window.ethereum.removeListener(...); };
  handler;
  return () => {};
}
```

- [ ] **Step 2: Write `useWallet.js`**

Create `frontend/src/hooks/useWallet.js`:
```js
// React hook wrapping lib/wallet.js. Exposes connection state and helpers.
// Spec §5.1. Signature stable; body TODO.

import { useCallback, useEffect, useState } from 'react';
import * as wallet from '../lib/wallet.js';

/**
 * @returns {{
 *   address: string | null,
 *   chainId: number | null,
 *   isConnected: boolean,
 *   connect: () => Promise<void>,
 *   disconnect: () => void,
 * }}
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);

  // TODO(Dev A):
  //   - on mount: subscribe via wallet.onAccountOrChainChange(refresh); call refresh() once.
  //   - refresh(): reads wallet.getSigner() + wallet.getChainId(), updates state.
  //   - connect(): call wallet.connect(), then refresh().
  //   - disconnect(): clear state. (Note: MetaMask has no programmatic disconnect.)

  const connect = useCallback(async () => {
    // TODO(Dev A): await wallet.connect(); refresh state.
    throw new Error('TODO: implement useWallet.connect()');
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    // TODO(Dev A): subscribe + initial refresh
  }, []);

  return {
    address,
    chainId,
    isConnected: !!address,
    connect,
    disconnect,
  };
}
```

- [ ] **Step 3: Write `useContract.js`**

Create `frontend/src/hooks/useContract.js`:
```js
// Returns instantiated ethers.Contract objects for VoterRegistry + Election,
// plus a convenience flag telling whether the connected address is an admin.
// Spec §5.1. Signature stable; body TODO.

import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './useWallet.js';
import addresses from '../contracts/addresses.json';
// ABI JSONs are created by scripts/sync-abi.sh after `forge build`.
// Until then these imports resolve to empty arrays and the contracts are unusable.
// TODO(Dev A): after first forge build, uncomment and verify files exist.
// import voterRegistryAbi from '../contracts/VoterRegistry.json';
// import electionAbi      from '../contracts/Election.json';

/**
 * @returns {{
 *   voterRegistry: import('ethers').Contract | null,
 *   election:      import('ethers').Contract | null,
 *   isAdmin: boolean,
 *   ready: boolean,
 * }}
 */
export function useContract() {
  const { address, chainId, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [contracts, setContracts] = useState({ voterRegistry: null, election: null });

  useEffect(() => {
    // TODO(Dev A):
    //   - if !isConnected: reset contracts to null, isAdmin to false, return.
    //   - resolve chainKey = String(chainId); look up addresses[chainKey].
    //   - get signer via wallet.getSigner().
    //   - new Contract(addresses[chainKey].voterRegistry, voterRegistryAbi.abi, signer);
    //     same for election.
    //   - call voterRegistry.isAdmin(address) → setIsAdmin.
  }, [address, chainId, isConnected]);

  return {
    voterRegistry: contracts.voterRegistry,
    election:      contracts.election,
    isAdmin,
    ready: !!(contracts.voterRegistry && contracts.election),
  };
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add frontend/src/lib/wallet.js frontend/src/hooks/useWallet.js frontend/src/hooks/useContract.js
git commit -m "feat(frontend): add wallet lib and useWallet/useContract hooks (skeleton)"
```

---

## Task 11: Write shared components

**Files:**
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/ConnectButton.jsx`
- Create: `frontend/src/components/ElectionSelector.jsx`
- Create: `frontend/src/components/CandidateCard.jsx`
- Create: `frontend/src/components/AddressBadge.jsx`

- [ ] **Step 1: Write `Layout.jsx`**

Create `frontend/src/components/Layout.jsx`:
```jsx
// Shared layout: top nav (Admin / Vote / Results) + ConnectButton + content outlet.
import { NavLink, Outlet } from 'react-router-dom';
import ConnectButton from './ConnectButton.jsx';

export default function Layout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <h1 className="layout__title">Voting DApp</h1>
        <nav className="layout__nav">
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/vote">Vote</NavLink>
          <NavLink to="/results">Results</NavLink>
        </nav>
        <ConnectButton />
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write `ConnectButton.jsx`**

Create `frontend/src/components/ConnectButton.jsx`:
```jsx
// Renders "Connect Wallet" or a short address badge when connected.
import { useWallet } from '../hooks/useWallet.js';
import AddressBadge from './AddressBadge.jsx';

export default function ConnectButton() {
  const { address, isConnected, connect } = useWallet();

  if (isConnected) {
    return <AddressBadge address={address} />;
  }
  return (
    <button type="button" onClick={connect} className="btn btn--primary">
      Connect Wallet
    </button>
  );
  // TODO(Dev A): surface errors from connect() via a toast or inline message.
}
```

- [ ] **Step 3: Write `ElectionSelector.jsx`**

Create `frontend/src/components/ElectionSelector.jsx`:
```jsx
// Dropdown of elections scoped by a `filter` predicate.
// Spec §5.2–§5.4. Skeleton: does not yet fetch from chain.
//
// Props:
//   - value: number | null          (selected electionId)
//   - onChange: (id: number) => void
//   - filter?: (e: ElectionSummary) => boolean   (defaults to "all")
//
// ElectionSummary shape: { id, name, state }

export default function ElectionSelector({ value, onChange, filter }) {
  // TODO(Dev B):
  //   - Use useContract().election to:
  //       * read electionCount
  //       * for each id, call getElection(id) → push into list
  //       * cache via useEffect on (election address, chainId)
  //   - Apply `filter` if provided.
  //   - Render <select>.
  //   - Handle loading / empty states.
  value; onChange; filter;
  return (
    <select disabled>
      <option>TODO: load elections</option>
    </select>
  );
}
```

- [ ] **Step 4: Write `CandidateCard.jsx`**

Create `frontend/src/components/CandidateCard.jsx`:
```jsx
// Displays one candidate: image, name, description, current vote count.
//
// Props:
//   - candidate: { id, name, description, imageUrl, voteCount }
//   - onVote?: (candidateId: number) => Promise<void>
//   - disabled?: boolean   (already voted / not open / not authorized)

export default function CandidateCard({ candidate, onVote, disabled }) {
  // TODO(Dev B):
  //   - Render <img src={candidate.imageUrl}> with a fallback for empty/broken URLs.
  //   - Show vote count formatted as integer (BigInt coming in from ethers).
  //   - Button labelled "Vote" calls onVote(candidate.id); hide/disable per `disabled`.
  return (
    <article className="candidate-card">
      <div className="candidate-card__image-placeholder">image</div>
      <h3>{candidate?.name ?? 'TODO name'}</h3>
      <p>{candidate?.description ?? 'TODO description'}</p>
      <p>Votes: {String(candidate?.voteCount ?? 0)}</p>
      <button
        type="button"
        onClick={() => onVote?.(candidate?.id)}
        disabled={disabled}
      >
        Vote
      </button>
    </article>
  );
}
```

- [ ] **Step 5: Write `AddressBadge.jsx`**

Create `frontend/src/components/AddressBadge.jsx`:
```jsx
// Tiny display for a truncated address: 0xabcd...1234.
// Props: { address: string }

export default function AddressBadge({ address }) {
  if (!address) return null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  // TODO(Dev A): optional — copy-to-clipboard on click, optional explorer link.
  return <span className="address-badge" title={address}>{short}</span>;
}
```

- [ ] **Step 6: Commit**

Run:
```bash
git add frontend/src/components/
git commit -m "feat(frontend): add shared components (Layout, ConnectButton, ElectionSelector, CandidateCard, AddressBadge)"
```

---

## Task 12: Write page skeletons

**Files:**
- Create: `frontend/src/pages/AdminPage.jsx`
- Create: `frontend/src/pages/VotePage.jsx`
- Create: `frontend/src/pages/ResultsPage.jsx`

- [ ] **Step 1: Write `AdminPage.jsx`**

Create `frontend/src/pages/AdminPage.jsx`:
```jsx
// Admin dashboard: elections, voters (per-election), admin-role management.
// Spec §5.2. Three sections on one page; each is a TODO skeleton.
import { useContract } from '../hooks/useContract.js';

export default function AdminPage() {
  const { isAdmin, ready } = useContract();

  if (!ready) return <p>Connect a wallet to continue.</p>;
  if (!isAdmin) return <p>Your account does not hold ADMIN_ROLE.</p>;

  return (
    <div className="admin-page">
      <section>
        <h2>Elections</h2>
        {/* TODO(Dev A):
            - List of all elections (use ElectionSelector's data source or a dedicated list).
            - "Create election" form (name, description) → election.createElection(...)
            - Per-row actions: "Add candidate" (opens form: name, description, imageUrl),
              "Start", "End". Gate by state.
        */}
        <p>TODO: elections list + create form + per-row actions</p>
      </section>

      <section>
        <h2>Voters</h2>
        {/* TODO(Dev A):
            - ElectionSelector to pick target election.
            - Address input + "Authorize" / "Revoke" buttons → voterRegistry.authorize/revoke.
            - Batch authorize: textarea of newline-separated addresses → authorizeVoters.
        */}
        <p>TODO: voter authorization UI</p>
      </section>

      <section>
        <h2>Admin roles</h2>
        {/* TODO(Dev A):
            - List of current ADMIN_ROLE holders, derived from RoleGranted/RoleRevoked events
              on BOTH voterRegistry and election (queryFilter(fromBlock=0)).
              Source of truth = intersection of both contracts (spec §3.4).
            - Grant/revoke form: address input; fires grantRole/revokeRole on BOTH contracts
              sequentially; shows per-tx status.
        */}
        <p>TODO: admin-role list + grant/revoke</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write `VotePage.jsx`**

Create `frontend/src/pages/VotePage.jsx`:
```jsx
// Voter flow: pick an Open election → see candidates → cast vote.
// Spec §5.3.
import { useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import ElectionSelector from '../components/ElectionSelector.jsx';

export default function VotePage() {
  const { ready } = useContract();
  const [electionId, setElectionId] = useState(null);

  if (!ready) return <p>Connect a wallet to continue.</p>;

  return (
    <div className="vote-page">
      <h2>Cast your vote</h2>
      <ElectionSelector
        value={electionId}
        onChange={setElectionId}
        // TODO(Dev B): filter={e => e.state === State.Open}
      />

      {/* TODO(Dev B):
          - If electionId is null → prompt to select.
          - Otherwise fetch candidates for electionId and render <CandidateCard> grid.
          - Disable Vote button if: !registry.isAuthorized(electionId, address) OR election.hasVoted (derive from past VoteCast events or a dedicated view).
          - On Vote: election.vote(electionId, candidateId); show pending/confirmed.
      */}
      <p>TODO: candidate list + vote action</p>
    </div>
  );
}
```

- [ ] **Step 3: Write `ResultsPage.jsx`**

Create `frontend/src/pages/ResultsPage.jsx`:
```jsx
// Live results + winner view for a selected election.
// Spec §5.4.
import { useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import ElectionSelector from '../components/ElectionSelector.jsx';

export default function ResultsPage() {
  const { ready } = useContract();
  const [electionId, setElectionId] = useState(null);

  if (!ready) return <p>Connect a wallet to view results.</p>;

  return (
    <div className="results-page">
      <h2>Results</h2>
      <ElectionSelector value={electionId} onChange={setElectionId} />

      {/* TODO(Dev B):
          - If election state === NotStarted → "Election has not started."
          - If Open → live running totals via getResults(id); refresh on VoteCast event.
          - If Ended → highlight getWinner(id); display final tally.
      */}
      <p>TODO: results render by state</p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add frontend/src/pages/
git commit -m "feat(frontend): add AdminPage, VotePage, ResultsPage skeletons"
```

---

## Task 13: Wire App routing, entry point, and base styles

**Files:**
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Write `App.jsx`**

Create `frontend/src/App.jsx`:
```jsx
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout      from './components/Layout.jsx';
import AdminPage   from './pages/AdminPage.jsx';
import VotePage    from './pages/VotePage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index             element={<Navigate to="/vote" replace />} />
        <Route path="admin"      element={<AdminPage />} />
        <Route path="vote"       element={<VotePage />} />
        <Route path="results"    element={<ResultsPage />} />
        <Route path="*"          element={<Navigate to="/vote" replace />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 2: Write `main.jsx`**

Create `frontend/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 3: Write `index.css` (minimal baseline only — dev can replace later)**

Create `frontend/src/index.css`:
```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: #f7f7f8;
  color: #111;
}

.layout__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
}

.layout__title   { font-size: 1.1rem; margin: 0; }
.layout__nav     { display: flex; gap: 0.75rem; margin-left: 1rem; }
.layout__nav a   { color: #444; text-decoration: none; }
.layout__nav a.active { color: #2563eb; font-weight: 600; }
.layout__main    { padding: 1.5rem; }

.address-badge   { font-family: ui-monospace, monospace; background: #eef; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: auto; }

.btn             { padding: 0.4rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; }
.btn--primary    { background: #2563eb; color: #fff; border-color: #2563eb; }

.candidate-card  { padding: 1rem; border: 1px solid #ddd; border-radius: 6px; background: #fff; margin-bottom: 1rem; }
.candidate-card__image-placeholder { width: 100%; aspect-ratio: 3/2; background: #eee; display: grid; place-items: center; margin-bottom: 0.5rem; }
```

- [ ] **Step 4: Verify dev server starts and renders**

Run:
```bash
cd frontend && npm run dev
```
Expected: Vite prints `Local: http://localhost:5173/`. Open it in a browser and confirm the header (Admin / Vote / Results nav + Connect Wallet button) renders without console errors. Then stop the server (Ctrl-C) and return to project root.

- [ ] **Step 5: Commit**

Run:
```bash
git add frontend/src/App.jsx frontend/src/main.jsx frontend/src/index.css
git commit -m "feat(frontend): wire router, entry point, and baseline styles"
```

---

## Task 14: Write orchestration scripts

**Files:**
- Create: `scripts/sync-abi.sh`
- Create: `scripts/dev.sh`

- [ ] **Step 1: Make scripts directory**

Run:
```bash
mkdir -p scripts
```

- [ ] **Step 2: Write `sync-abi.sh`**

Create `scripts/sync-abi.sh`:
```bash
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
```

- [ ] **Step 3: Write `dev.sh`**

Create `scripts/dev.sh`:
```bash
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
```

- [ ] **Step 4: Make scripts executable**

Run:
```bash
chmod +x scripts/sync-abi.sh scripts/dev.sh
```

- [ ] **Step 5: Commit**

Run:
```bash
git add scripts/sync-abi.sh scripts/dev.sh
git commit -m "chore(scripts): add sync-abi.sh and dev.sh orchestration"
```

---

## Task 15: Write root README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md`:
````markdown
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
cd contracts && forge install --no-commit foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts && cd ..

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
````

- [ ] **Step 2: Commit**

Run:
```bash
git add README.md
git commit -m "docs: add root README with setup, dev loop, deploy, and ownership"
```

---

## Task 16: Final verification

No new files — this task confirms the scaffold is coherent.

- [ ] **Step 1: List the tree**

Run:
```bash
find . -type f \
  -not -path './.git/*' \
  -not -path './**/node_modules/*' \
  -not -path './contracts/lib/*' \
  -not -path './contracts/out/*' \
  -not -path './contracts/cache/*' \
  -not -path './**/.DS_Store' \
  | sort
```
Expected: the file list matches the tree in the "File structure" section at the top of this plan.

- [ ] **Step 2: Build contracts end-to-end**

Run:
```bash
cd contracts && forge build && forge test -vv && cd ..
```
Expected: build succeeds; tests pass (all empty bodies).

- [ ] **Step 3: Start frontend and open once**

Run (separate terminal or background):
```bash
cd frontend && npm run dev
```
Expected: Vite starts, browser loads the header. Stop it.

- [ ] **Step 4: Confirm git log**

Run:
```bash
git log --oneline
```
Expected: 15 commits (one per task, except this verification task).

- [ ] **Step 5: Tag the scaffold**

Run:
```bash
git tag -a v0.1.0-scaffold -m "Scaffold complete — skeletons only, TODOs everywhere"
```

- [ ] **Step 6: Hand off to Dev A and Dev B**

No command. Tell the team:
- The spec is at `docs/superpowers/specs/2026-04-25-voting-dapp-design.md`.
- Every TODO cites the spec section it implements.
- Phase 1 kickoff meeting: confirm the `IVoterRegistry` interface and `Election` event/error names match the spec exactly; lock before parallel work.
- `forge test -vv` must stay green throughout — a failing test in main means the last commit broke something.

---

## Self-review notes

- **Spec coverage:** Tasks 3–7 cover spec §4.1–§4.4; Tasks 8–13 cover §5.1–§5.4; Task 14 covers §7; Task 15 covers §9 README requirements.
- **No placeholders in code:** every skeleton file is written in full. `TODO(Dev A/B)` comments quote the spec rule and are intentional implementation markers, not plan gaps.
- **Type consistency:** `ADMIN_ROLE` bytes32 constant appears with identical name in VoterRegistry, Election, tests, and docs. `State { NotStarted, Open, Ended }` appears once (in Election) and is referenced by name. `Candidate` struct fields `(id, name, description, imageUrl, voteCount)` are identical across contract, tests, and `CandidateCard.jsx`.
- **Commits:** 15 atomic commits — each task commits independently so a failure mid-plan can be resumed without losing prior work.
