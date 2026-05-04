# Dev A Phase 1 — Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill every `TODO(Dev A)` in `VoterRegistry.sol` and `VoterRegistry.t.sol`, leaving `forge test -vv` green (16 + 27 tests) after every commit.

**Architecture:** Interleaved TDD by cluster. Each task: write failing tests first, implement the contract logic, verify green, commit. Four clusters cover `VoterRegistry.sol` in dependency order: constructor → authorizeVoter → revokeVoter → authorizeVoters + isolation.

**Tech Stack:** Solidity 0.8.24, Foundry (forge test / forge build), OpenZeppelin AccessControl v5, forge-std Test + cheatcodes (`vm.prank`, `vm.expectRevert`, `vm.expectEmit`).

**Design reference:** `docs/superpowers/specs/2026-04-29-deva-phase1-design.md` — read it before starting.

---

## File structure

```
contracts/
  src/
    VoterRegistry.sol          ← modified in Tasks 1–4 (fill TODO bodies + uncomment storage)
  test/
    VoterRegistry.t.sol        ← modified in Tasks 1–4 (fill 16 test bodies)
```

All other files are read-only for this plan.

---

## Task 1: Cluster 1 — Constructor + `isAdmin` + role administration

**Files:**
- Modify: `contracts/src/VoterRegistry.sol`
- Modify: `contracts/test/VoterRegistry.t.sol`

- [ ] **Step 1: Write the failing tests**

Open `contracts/test/VoterRegistry.t.sol`. Replace the three empty constructor test bodies and the three empty role administration test bodies:

```solidity
function test_constructor_revertsOnEmptyAdminList() public {
    vm.expectRevert(IVoterRegistry.NotAdmin.selector);
    new VoterRegistry(new address[](0));
}

function test_constructor_revertsOnZeroAdmin() public {
    address[] memory admins = new address[](2);
    admins[0] = admin;
    admins[1] = address(0);
    vm.expectRevert(IVoterRegistry.ZeroAddress.selector);
    new VoterRegistry(admins);
}

function test_constructor_grantsRolesToSeedAdmins() public {
    assertTrue(registry.isAdmin(admin));
    assertFalse(registry.isAdmin(other));
}

function test_grantRole_byDefaultAdmin() public {
    vm.prank(admin);
    registry.grantRole(registry.ADMIN_ROLE(), other);
    assertTrue(registry.isAdmin(other));
}

function test_revokeRole_byDefaultAdmin() public {
    vm.prank(admin);
    registry.revokeRole(registry.ADMIN_ROLE(), admin);
    assertFalse(registry.isAdmin(admin));
}

function test_isAdmin_reflectsRoleState() public {
    assertFalse(registry.isAdmin(other));
    vm.prank(admin);
    registry.grantRole(registry.ADMIN_ROLE(), other);
    assertTrue(registry.isAdmin(other));
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_constructor|test_grantRole|test_revokeRole|test_isAdmin" -vv && cd ..
```
Expected: `test_constructor_revertsOnEmptyAdminList` and `test_constructor_revertsOnZeroAdmin` FAIL because the constructor never reverts. `test_constructor_grantsRolesToSeedAdmins` FAILS because `isAdmin` returns false. `test_grantRole_byDefaultAdmin`, `test_revokeRole_byDefaultAdmin`, and `test_isAdmin_reflectsRoleState` FAIL because `isAdmin` always returns false.

- [ ] **Step 3: Implement VoterRegistry.sol — storage, constructor, isAdmin**

Open `contracts/src/VoterRegistry.sol`. Make three changes:

**3a — Uncomment the storage mapping** (replace the comment block):
```solidity
// TODO(Dev A): (electionId => (voter => authorized?))
// mapping(uint256 => mapping(address => bool)) private _authorized;
```
→
```solidity
mapping(uint256 => mapping(address => bool)) private _authorized;
```

**3b — Replace the constructor body:**
```solidity
constructor(address[] memory initialAdmins) {
    if (initialAdmins.length == 0) revert NotAdmin();
    for (uint256 i = 0; i < initialAdmins.length; i++) {
        if (initialAdmins[i] == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmins[i]);
        _grantRole(ADMIN_ROLE, initialAdmins[i]);
    }
}
```

**3c — Replace the `isAdmin` body:**
```solidity
function isAdmin(address account) external view returns (bool) {
    return hasRole(ADMIN_ROLE, account);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_constructor|test_grantRole|test_revokeRole|test_isAdmin" -vv && cd ..
```
Expected: all 6 tests PASS. Full suite still passes (other VoterRegistry tests are empty no-ops; Election tests are unaffected).

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/VoterRegistry.sol test/VoterRegistry.t.sol && cd ..
git commit -m "feat(contracts): implement VoterRegistry constructor and isAdmin (Dev A)"
```

---

## Task 2: Cluster 2 — `authorizeVoter`

**Files:**
- Modify: `contracts/src/VoterRegistry.sol`
- Modify: `contracts/test/VoterRegistry.t.sol`

- [ ] **Step 1: Write the failing tests**

Open `contracts/test/VoterRegistry.t.sol`. Replace the four empty `authorizeVoter` test bodies:

```solidity
function test_authorizeVoter_happyPath() public {
    vm.prank(admin);
    vm.expectEmit(true, true, true, false);
    emit IVoterRegistry.VoterAuthorized(ELECTION_ID, voter, admin);
    registry.authorizeVoter(ELECTION_ID, voter);
    assertTrue(registry.isAuthorized(ELECTION_ID, voter));
}

function test_authorizeVoter_revertsWhenNonAdmin() public {
    vm.prank(other);
    vm.expectRevert();
    registry.authorizeVoter(ELECTION_ID, voter);
}

function test_authorizeVoter_revertsOnZeroAddress() public {
    vm.prank(admin);
    vm.expectRevert(IVoterRegistry.ZeroAddress.selector);
    registry.authorizeVoter(ELECTION_ID, address(0));
}

function test_authorizeVoter_revertsWhenAlreadyAuthorized() public {
    vm.prank(admin);
    registry.authorizeVoter(ELECTION_ID, voter);

    vm.prank(admin);
    vm.expectRevert(IVoterRegistry.AlreadyAuthorized.selector);
    registry.authorizeVoter(ELECTION_ID, voter);
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_authorizeVoter" -vv && cd ..
```
Expected: all 4 FAIL — `authorizeVoter` still reverts with `TODO()` for every call.

- [ ] **Step 3: Implement `authorizeVoter` in VoterRegistry.sol**

Replace the `authorizeVoter` body and remove the `/* onlyRole(ADMIN_ROLE) */` comment wrapper — make the modifier active:

```solidity
function authorizeVoter(uint256 electionId, address voter)
    external
    onlyRole(ADMIN_ROLE)
{
    if (voter == address(0)) revert ZeroAddress();
    if (_authorized[electionId][voter]) revert AlreadyAuthorized();
    _authorized[electionId][voter] = true;
    emit VoterAuthorized(electionId, voter, msg.sender);
}
```

Note: `test_authorizeVoter_revertsWhenNonAdmin` uses bare `vm.expectRevert()` with no selector. This is intentional — OZ `AccessControl` reverts with its own `AccessControlUnauthorizedAccount` error, not our custom `NotAdmin`.

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest -vv && cd ..
```
Expected: 10 tests pass (6 from Task 1 + 4 new). Zero failures.

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/VoterRegistry.sol test/VoterRegistry.t.sol && cd ..
git commit -m "feat(contracts): implement authorizeVoter (Dev A)"
```

---

## Task 3: Cluster 3 — `revokeVoter`

**Files:**
- Modify: `contracts/src/VoterRegistry.sol`
- Modify: `contracts/test/VoterRegistry.t.sol`

- [ ] **Step 1: Write the failing tests**

Open `contracts/test/VoterRegistry.t.sol`. Replace the two empty `revokeVoter` test bodies:

```solidity
function test_revokeVoter_happyPath() public {
    vm.prank(admin);
    registry.authorizeVoter(ELECTION_ID, voter);

    vm.prank(admin);
    vm.expectEmit(true, true, true, false);
    emit IVoterRegistry.VoterRevoked(ELECTION_ID, voter, admin);
    registry.revokeVoter(ELECTION_ID, voter);

    assertFalse(registry.isAuthorized(ELECTION_ID, voter));
}

function test_revokeVoter_revertsWhenNotAuthorized() public {
    vm.prank(admin);
    vm.expectRevert(IVoterRegistry.NotAuthorized.selector);
    registry.revokeVoter(ELECTION_ID, voter);
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_revokeVoter" -vv && cd ..
```
Expected: both FAIL — `revokeVoter` still reverts with `TODO()`.

- [ ] **Step 3: Implement `revokeVoter` in VoterRegistry.sol**

Replace the `revokeVoter` body and remove the `/* onlyRole(ADMIN_ROLE) */` comment wrapper:

```solidity
function revokeVoter(uint256 electionId, address voter)
    external
    onlyRole(ADMIN_ROLE)
{
    if (!_authorized[electionId][voter]) revert NotAuthorized();
    _authorized[electionId][voter] = false;
    emit VoterRevoked(electionId, voter, msg.sender);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest -vv && cd ..
```
Expected: 12 tests pass (10 prior + 2 new). Zero failures.

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/VoterRegistry.sol test/VoterRegistry.t.sol && cd ..
git commit -m "feat(contracts): implement revokeVoter (Dev A)"
```

---

## Task 4: Cluster 4 — `authorizeVoters` + `isAuthorized` + final cleanup

**Files:**
- Modify: `contracts/src/VoterRegistry.sol`
- Modify: `contracts/test/VoterRegistry.t.sol`

- [ ] **Step 1: Write the failing tests**

Open `contracts/test/VoterRegistry.t.sol`. Replace the three empty `authorizeVoters` test bodies and the one empty isolation test body:

```solidity
function test_authorizeVoters_happyPath() public {
    address voter2 = makeAddr("voter2");
    address[] memory voters = new address[](2);
    voters[0] = voter;
    voters[1] = voter2;

    vm.prank(admin);
    registry.authorizeVoters(ELECTION_ID, voters);

    assertTrue(registry.isAuthorized(ELECTION_ID, voter));
    assertTrue(registry.isAuthorized(ELECTION_ID, voter2));
}

function test_authorizeVoters_revertsOnFirstZeroAddress() public {
    address[] memory voters = new address[](2);
    voters[0] = voter;
    voters[1] = address(0);

    vm.prank(admin);
    vm.expectRevert(IVoterRegistry.ZeroAddress.selector);
    registry.authorizeVoters(ELECTION_ID, voters);
}

function test_authorizeVoters_revertsOnFirstDuplicate() public {
    address[] memory voters = new address[](2);
    voters[0] = voter;
    voters[1] = voter;

    vm.prank(admin);
    vm.expectRevert(IVoterRegistry.AlreadyAuthorized.selector);
    registry.authorizeVoters(ELECTION_ID, voters);
}

function test_isAuthorized_isPerElection() public {
    uint256 otherElection = 1;
    vm.prank(admin);
    registry.authorizeVoter(ELECTION_ID, voter);

    assertTrue(registry.isAuthorized(ELECTION_ID, voter));
    assertFalse(registry.isAuthorized(otherElection, voter));
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_authorizeVoters|test_isAuthorized" -vv && cd ..
```
Expected: all 4 FAIL — `authorizeVoters` still reverts with `TODO()`; `isAuthorized` always returns false so isolation test fails.

- [ ] **Step 3: Implement `authorizeVoters` and `isAuthorized` in VoterRegistry.sol**

**Replace `authorizeVoters` body** and remove the `/* onlyRole(ADMIN_ROLE) */` comment wrapper:

```solidity
function authorizeVoters(uint256 electionId, address[] calldata voters)
    external
    onlyRole(ADMIN_ROLE)
{
    for (uint256 i = 0; i < voters.length; i++) {
        if (voters[i] == address(0)) revert ZeroAddress();
        if (_authorized[electionId][voters[i]]) revert AlreadyAuthorized();
        _authorized[electionId][voters[i]] = true;
        emit VoterAuthorized(electionId, voters[i], msg.sender);
    }
}
```

**Replace `isAuthorized` body:**

```solidity
function isAuthorized(uint256 electionId, address voter) external view returns (bool) {
    return _authorized[electionId][voter];
}
```

**Remove `error TODO();`** from the errors section — all skeleton sentinels are now gone:
```solidity
error TODO();              // ← delete this line
```

- [ ] **Step 4: Run the full test suite — all 43 must pass**

Run:
```bash
cd contracts && forge test -vv && cd ..
```
Expected: `16 tests passed` in `VoterRegistryTest`, `27 tests passed` in `ElectionTest`. Zero failures.

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/VoterRegistry.sol test/VoterRegistry.t.sol && cd ..
git commit -m "feat(contracts): implement authorizeVoters and isAuthorized (Dev A)"
```

---

## Final verification

- [ ] **Confirm git log**

Run:
```bash
git log --oneline -6
```
Expected: 4 new commits on top of the scaffold, one per task:
```
feat(contracts): implement authorizeVoters and isAuthorized (Dev A)
feat(contracts): implement revokeVoter (Dev A)
feat(contracts): implement authorizeVoter (Dev A)
feat(contracts): implement VoterRegistry constructor and isAdmin (Dev A)
```
