# Dev A Phase 1 — VoterRegistry Contracts Design

**Author:** Dev A  
**Date:** 2026-04-29  
**Status:** Approved

---

## Goal

Fill every `TODO(Dev A)` in `VoterRegistry.sol` and `VoterRegistry.t.sol` using interleaved TDD — write failing tests first, implement, verify green, commit. `forge test -vv` must stay green after every commit.

## Architecture

`VoterRegistry` is a single-mapping authorization contract. No state machine, no structs. All business logic reduces to:

- One nested mapping: `mapping(uint256 => mapping(address => bool)) private _authorized`
- Role guards via OpenZeppelin `AccessControl` (already inherited in the skeleton)
- Five function bodies to fill + `isAdmin` view

Errors (`NotAdmin`, `AlreadyAuthorized`, `NotAuthorized`, `ZeroAddress`) are declared in `IVoterRegistry` — tests reference them as `IVoterRegistry.<Error>.selector`. This differs from `Election.sol` which declared its own errors locally.

`error TODO()` is removed in the final cluster once all bodies are filled.

## Files

```
contracts/
  src/VoterRegistry.sol       ← modified in Tasks 1–4
  test/VoterRegistry.t.sol    ← modified in Tasks 1–4
```

All other files are read-only for this plan.

## Commit structure

```
feat(contracts): implement VoterRegistry constructor and isAdmin (Dev A)
feat(contracts): implement authorizeVoter (Dev A)
feat(contracts): implement revokeVoter (Dev A)
feat(contracts): implement authorizeVoters and isAuthorized (Dev A)
```

---

## Cluster 1 — Constructor + `isAdmin` + role administration (6 tests)

### Test bodies (`VoterRegistry.t.sol`)

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

### Contract changes (`VoterRegistry.sol`)

**Uncomment the storage mapping:**
```solidity
mapping(uint256 => mapping(address => bool)) private _authorized;
```

**Replace constructor body:**
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

**Replace `isAdmin` body:**
```solidity
function isAdmin(address account) external view returns (bool) {
    return hasRole(ADMIN_ROLE, account);
}
```

### Verify command
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_constructor|test_grantRole|test_revokeRole|test_isAdmin" -vv && cd ..
```
Expected: 6 tests pass.

---

## Cluster 2 — `authorizeVoter` (4 tests)

### Test bodies

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

### Contract change

Replace `authorizeVoter` body and activate the `onlyRole` modifier (remove the `/* */` comment wrapper):

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

`test_authorizeVoter_revertsWhenNonAdmin` uses bare `vm.expectRevert()` (no selector) because OZ `AccessControl` reverts with `AccessControlUnauthorizedAccount`, not our custom `NotAdmin`.

### Verify command
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_authorizeVoter" -vv && cd ..
```
Expected: 4 tests pass. Prior 6 still pass.

---

## Cluster 3 — `revokeVoter` (2 tests)

### Test bodies

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

### Contract change

Replace `revokeVoter` body and activate the `onlyRole` modifier:

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

### Verify command
```bash
cd contracts && forge test --match-contract VoterRegistryTest --match-test "test_revokeVoter" -vv && cd ..
```
Expected: 2 tests pass. Prior 10 still pass.

---

## Cluster 4 — `authorizeVoters` + `isAuthorized` isolation (4 tests)

### Test bodies

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

### Contract changes

Replace `authorizeVoters` body and activate the `onlyRole` modifier:

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

Replace `isAuthorized` body:

```solidity
function isAuthorized(uint256 electionId, address voter) external view returns (bool) {
    return _authorized[electionId][voter];
}
```

Also **remove `error TODO();`** from the errors section — all skeletons are filled.

### Verify command (full suite)
```bash
cd contracts && forge test -vv && cd ..
```
Expected: all 16 `VoterRegistryTest` tests pass + all 27 `ElectionTest` tests pass. Zero failures.

---

## Error reference

| Error | Defined in | Used by |
|-------|-----------|---------|
| `NotAdmin` | `IVoterRegistry` | constructor (empty list) |
| `ZeroAddress` | `IVoterRegistry` | constructor (zero element), `authorizeVoter`, `authorizeVoters` |
| `AlreadyAuthorized` | `IVoterRegistry` | `authorizeVoter`, `authorizeVoters` |
| `NotAuthorized` | `IVoterRegistry` | `revokeVoter` |
