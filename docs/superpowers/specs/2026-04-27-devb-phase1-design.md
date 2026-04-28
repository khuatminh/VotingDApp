# Dev B — Phase 1 Implementation Design

**Date:** 2026-04-27
**Status:** Approved
**Scope:** Phase 1 backend only — `Election.sol` (fill skeletons), `Election.t.sol` (write 27 test bodies), `Deploy.s.sol` (implement run + SEED_ADMINS parsing). Phase 2 (frontend) is a separate session.

**Source of truth:** [`2026-04-25-voting-dapp-design.md`](2026-04-25-voting-dapp-design.md) — spec wins on any conflict.

---

## 1. Decisions locked in brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| Implementation order | Phase 1 (contracts) before Phase 2 (frontend) | Tests the contract in isolation before wiring the UI |
| Testing approach | Interleaved by feature cluster | Implement cluster → write tests → `forge test` → commit. Avoids rationalizing tests against a buggy impl; cleaner git history for the report |
| Election.sol validation pattern | Internal storage-pointer helper (`_election`) | Idiomatic Solidity, DRY, zero gas overhead vs inline; report-worthy pattern |
| `_parseSeedAdmins` | Pragmatic — `vm.envAddress(key, delimiter)` with try/catch fallback | Two lines instead of thirty; Foundry handles CSV natively |

---

## 2. `Election.sol` design

### 2.1 Storage addition

Uncomment the one TODO at the top of the storage section:

```solidity
mapping(uint256 => ElectionData) private _elections;
```

### 2.2 Internal storage-pointer helper (new — not in skeleton)

Add one private function. Every admin function and view calls this first:

```solidity
function _election(uint256 id) private view returns (ElectionData storage e) {
    if (id >= electionCount) revert ElectionNotFound();
    e = _elections[id];
}
```

No bounds-check duplication anywhere else in the contract.

### 2.3 Constructor

Four steps, in order:

1. `if (registryAddress == address(0)) revert ...` — no named error in skeleton for this; use a bare `require(registryAddress != address(0))` to avoid adding an undeclared error.
2. `registry = IVoterRegistry(registryAddress)` — immutable; must be assigned here.
3. `if (initialAdmins.length == 0) revert NotAdmin()` — reuses the existing `NotAdmin` error.
4. Loop over `initialAdmins`: `_grantRole(DEFAULT_ADMIN_ROLE, admin)` + `_grantRole(ADMIN_ROLE, admin)`. No zero-address check needed here — AccessControl handles it.

### 2.4 Feature clusters

Implement in this order; each cluster is one implement → test → commit cycle.

#### Cluster 1: Constructor + `isAdmin`
- Constructor as above.
- `isAdmin(address account)`: `return hasRole(ADMIN_ROLE, account);`

#### Cluster 2: Election lifecycle

**`createElection`**
```
onlyRole(ADMIN_ROLE)
if (bytes(name).length == 0) revert EmptyName();
electionId = electionCount++;
// Access _elections directly here — NOT via _election() helper,
// because _election() reverts on id >= electionCount and the slot
// is only valid after electionCount is incremented above.
ElectionData storage e = _elections[electionId];
e.id = electionId; e.name = name; e.description = description;
e.creator = msg.sender; e.state = State.NotStarted;
emit ElectionCreated(electionId, msg.sender, name);
```

**`addCandidate`**
```
onlyRole(ADMIN_ROLE)
ElectionData storage e = _election(electionId);
if (e.state == State.Open)   revert ElectionAlreadyStarted();
if (e.state == State.Ended)  revert ElectionAlreadyEnded();
if (bytes(name).length == 0) revert EmptyName();
candidateId = e.candidateCount++;
e.candidates[candidateId] = Candidate(candidateId, name, description, imageUrl, 0);
emit CandidateAdded(electionId, candidateId, name);
```
Note: two distinct errors for wrong state — `ElectionAlreadyStarted` when `Open`, `ElectionAlreadyEnded` when `Ended`. More useful than a generic error.

**`startElection`**
```
onlyRole(ADMIN_ROLE)
ElectionData storage e = _election(electionId);
if (e.state != State.NotStarted) revert ElectionAlreadyStarted();
if (e.candidateCount == 0)       revert NoCandidates();
e.state = State.Open;
emit ElectionStarted(electionId);
```

**`endElection`**
```
onlyRole(ADMIN_ROLE)
ElectionData storage e = _election(electionId);
if (e.state != State.Open) revert ElectionNotOpen();
e.state = State.Ended;
emit ElectionEnded(electionId);
```

#### Cluster 3: Vote

Check order matters — existence first, then state, then auth, then duplicate, then candidateId bounds:

```
ElectionData storage e = _election(electionId);
if (e.state != State.Open)                              revert ElectionNotOpen();
if (!registry.isAuthorized(electionId, msg.sender))     revert VoterNotAuthorized();
if (e.hasVoted[msg.sender])                             revert AlreadyVoted();
if (candidateId >= e.candidateCount)                    revert CandidateNotFound();
e.hasVoted[msg.sender] = true;
e.candidates[candidateId].voteCount++;
e.totalVotes++;
emit VoteCast(electionId, candidateId, msg.sender);
```

#### Cluster 4: Views

**`getElection`**
```
ElectionData storage e = _election(electionId);
return (e.id, e.name, e.description, e.creator, e.state, e.candidateCount, e.totalVotes);
```

**`getCandidate`**
```
ElectionData storage e = _election(electionId);
if (candidateId >= e.candidateCount) revert CandidateNotFound();
return e.candidates[candidateId];
```

**`getCandidateCount`**
```
return _election(electionId).candidateCount;
```

**`getResults`** — must iterate the mapping into a memory array:
```
ElectionData storage e = _election(electionId);
Candidate[] memory result = new Candidate[](e.candidateCount);
for (uint256 i = 0; i < e.candidateCount; i++) {
    result[i] = e.candidates[i];
}
return result;
```

**`getWinner`** — linear scan, tiebreak by lowest candidateId:
```
ElectionData storage e = _election(electionId);
if (e.state != State.Ended)  revert ElectionNotEnded();
if (e.totalVotes == 0)       revert NoVotesCast();
Candidate memory winner = e.candidates[0];
for (uint256 i = 1; i < e.candidateCount; i++) {
    if (e.candidates[i].voteCount > winner.voteCount) {
        winner = e.candidates[i];
    }
    // ties: do NOT update winner — lowest id wins by keeping first occurrence
}
return winner;
```

---

## 3. `Election.t.sol` design

### 3.1 Test helper (add to `ElectionTest` contract)

Reduces setup boilerplate in lifecycle + vote tests:

```solidity
function _createWithCandidate() internal returns (uint256 electionId) {
    vm.startPrank(admin);
    electionId = election.createElection("E", "desc");
    election.addCandidate(electionId, "Alice", "bio", "");
    vm.stopPrank();
}
```

### 3.2 Foundry patterns used

```solidity
vm.prank(admin)                          // single next call from admin
vm.startPrank(admin) / vm.stopPrank()    // multiple calls from admin
vm.expectRevert(Election.SomeError.selector)
vm.expectEmit(true, true, true, true)
assertEq(x, y) / assertTrue(b)
```

### 3.3 Cluster-by-cluster test notes

**Constructor (4 tests)**
- `test_constructor_setsRegistryImmutable`: deploy fresh `Election`, assert `election.registry() == address(registry)`.
- `test_constructor_revertsOnZeroRegistry`: `vm.expectRevert(...)` then `new Election(address(0), admins)`.
- `test_constructor_revertsOnEmptyAdminList`: `new Election(address(registry), new address[](0))`.
- `test_constructor_grantsRolesToSeedAdmins`: `assertTrue(election.isAdmin(admin))`.

**createElection (4 tests)**
- Happy path: call `election.createElection`, check returned id=0, `getElection` returns correct fields, state=NotStarted, creator=admin.
- `revertsOnEmptyName`: `vm.expectRevert(Election.EmptyName.selector)`.
- `revertsWhenNonAdmin`: `vm.prank(other)` then call.
- `incrementsElectionCount`: create twice, assert `electionCount == 2`.

**addCandidate (4 tests)**
- Happy path: candidateId=0, `getCandidate` returns correct fields.
- `revertsWhenStarted`: create → start → try to add candidate → expect `ElectionAlreadyStarted`.
- `revertsWhenNonAdmin`: standard.
- `revertsOnEmptyName`: standard.

**Lifecycle (5 tests)**
- `startElection_happyPath`: state becomes Open, event emitted.
- `startElection_revertsWithoutCandidates`: create election (no candidates) → try start → `NoCandidates`.
- `startElection_revertsWhenAlreadyStarted`: start twice → second reverts.
- `endElection_happyPath`: start → end, state=Ended, event.
- `endElection_revertsWhenNotOpen`: try to end a NotStarted election → `ElectionNotOpen`.

**Vote (5 tests)**
- Happy path: `registry.setAuthorized(0, voter1, true)` → drive to Open → vote → check `getCandidate(0,0).voteCount == 1` and `getElection(0).totalVotes == 1`.
- `revertsWhenNotOpen` (not started case): vote before start.
- `revertsWhenNotOpen` (ended case): vote after end.
- `revertsWhenNotAuthorized`: voter not in registry.
- `revertsWhenAlreadyVoted`: vote twice with same voter.
- `revertsOnUnknownCandidate`: vote for candidateId=999.

**Views (4 tests)**
- `getResults_returnsAllCandidates`: add 2 candidates, assert array length=2 and correct data.
- `getWinner_revertsWhenNotEnded`: call on Open election.
- `getWinner_revertsOnNoVotes`: end election with 0 votes.
- `getWinner_tiebreakByLowestId`: add 2 candidates; voter1 votes for 0, voter2 votes for 1 (both voteCount=1); assert `getWinner.id == 0`.

**Concurrent elections (1 test)**
- Create elections 0 and 1; authorize voter1 only for election 0; drive both to Open; vote in 0; assert `getElection(1).totalVotes == 0` and `getElection(0).totalVotes == 1`.

---

## 4. `Deploy.s.sol` design

### `_parseSeedAdmins`

```solidity
function _parseSeedAdmins(address deployer) internal view returns (address[] memory) {
    try vm.envAddress("SEED_ADMINS", ",") returns (address[] memory parsed) {
        if (parsed.length > 0) return parsed;
    } catch {}
    address[] memory fallback_ = new address[](1);
    fallback_[0] = deployer;
    return fallback_;
}
```

`vm.envAddress(key, delimiter)` is available in Foundry ≥ 0.2.0 and handles CSV natively. `try/catch` covers both "env var not set" and "empty string" without manual parsing.

### `run()`

```solidity
function run() external returns (VoterRegistry registry, Election election) {
    uint256 pk       = vm.envUint("PRIVATE_KEY");
    address deployer = vm.addr(pk);
    address[] memory admins = _parseSeedAdmins(deployer);

    vm.startBroadcast(pk);
    registry = new VoterRegistry(admins);
    election = new Election(address(registry), admins);
    vm.stopBroadcast();

    console2.log("VoterRegistry:", address(registry));
    console2.log("Election:     ", address(election));
}
```

---

## 5. Commit sequence

| # | Commit message | Content |
|---|---|---|
| 1 | `feat(contracts): implement Election constructor and isAdmin (Dev B)` | Cluster 1 impl + tests |
| 2 | `feat(contracts): implement election lifecycle (Dev B)` | Cluster 2 impl + tests |
| 3 | `feat(contracts): implement vote (Dev B)` | Cluster 3 impl + tests |
| 4 | `feat(contracts): implement Election views (Dev B)` | Cluster 4 impl + tests |
| 5 | `feat(contracts): implement Deploy script (Dev B)` | Deploy.s.sol |

Each commit leaves `forge test -vv` green.
