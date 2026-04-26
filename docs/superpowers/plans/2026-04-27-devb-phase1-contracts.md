# Dev B Phase 1 — Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill in every `TODO(Dev B)` body in `Election.sol`, write all 27 tests in `Election.t.sol`, and implement `Deploy.s.sol` — leaving `forge test -vv` green after every commit.

**Architecture:** Interleaved TDD by feature cluster. Each task: write test assertions first (they will fail against the skeleton), implement the contract logic, verify green, commit. Four clusters cover Election.sol in order of dependency: constructor → lifecycle → vote → views. Deploy script is a separate final task.

**Tech Stack:** Solidity 0.8.24, Foundry (forge test / forge build), OpenZeppelin AccessControl v5, forge-std Test + cheatcodes (`vm.prank`, `vm.expectRevert`, `vm.expectEmit`).

**Design reference:** `docs/superpowers/specs/2026-04-27-devb-phase1-design.md` — read it before starting.

---

## File structure

```
contracts/
  src/
    Election.sol          ← modified in Tasks 1–4 (fill TODO bodies + add _election helper + uncomment storage)
  test/
    Election.t.sol        ← modified in Tasks 1–4 (fill 27 test bodies + add _createWithCandidate helper)
  script/
    Deploy.s.sol          ← modified in Task 5 (implement run() + _parseSeedAdmins())
```

All other files are read-only for this plan.

---

## Task 1: Cluster 1 — Constructor + `isAdmin`

**Files:**
- Modify: `contracts/src/Election.sol`
- Modify: `contracts/test/Election.t.sol`

- [ ] **Step 1: Write the failing tests**

Open `contracts/test/Election.t.sol`. Replace the four empty constructor test bodies and the empty `test_constructor_grantsRolesToSeedAdmins` body:

```solidity
function test_constructor_setsRegistryImmutable() public {
    assertEq(address(election.registry()), address(registry));
}

function test_constructor_revertsOnZeroRegistry() public {
    address[] memory admins = new address[](1);
    admins[0] = admin;
    vm.expectRevert("Election: zero registry");
    new Election(address(0), admins);
}

function test_constructor_revertsOnEmptyAdminList() public {
    vm.expectRevert(Election.NotAdmin.selector);
    new Election(address(registry), new address[](0));
}

function test_constructor_grantsRolesToSeedAdmins() public {
    assertTrue(election.isAdmin(admin));
    assertFalse(election.isAdmin(other));
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest --match-test "test_constructor" -vv && cd ..
```
Expected: `test_constructor_setsRegistryImmutable` passes (skeleton already sets registry), the other three FAIL — `revertsOnZeroRegistry` and `revertsOnEmptyAdminList` fail because no revert happens, `grantsRolesToSeedAdmins` fails because `isAdmin` returns false.

- [ ] **Step 3: Implement Election.sol — storage, helper, constructor, isAdmin**

Open `contracts/src/Election.sol`. Make four changes:

**3a — Uncomment the storage mapping** (line ~58, replace the comment):
```solidity
// TODO(Dev B): mapping(uint256 => ElectionData) private _elections;
```
→
```solidity
mapping(uint256 => ElectionData) private _elections;
```

**3b — Add `_election()` private helper** immediately after the storage section, before the events section:
```solidity
// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

/// @dev Validates electionId and returns a storage pointer. Used by every
///      function that reads or mutates an existing election.
function _election(uint256 id) private view returns (ElectionData storage e) {
    if (id >= electionCount) revert ElectionNotFound();
    e = _elections[id];
}
```

**3c — Replace the constructor body:**
```solidity
constructor(address registryAddress, address[] memory initialAdmins) {
    require(registryAddress != address(0), "Election: zero registry");
    registry = IVoterRegistry(registryAddress);
    if (initialAdmins.length == 0) revert NotAdmin();
    for (uint256 i = 0; i < initialAdmins.length; i++) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmins[i]);
        _grantRole(ADMIN_ROLE, initialAdmins[i]);
    }
}
```

**3d — Replace the `isAdmin` body:**
```solidity
function isAdmin(address account) external view returns (bool) {
    return hasRole(ADMIN_ROLE, account);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest --match-test "test_constructor" -vv && cd ..
```
Expected: all 4 constructor tests PASS. Full suite still passes (other tests are empty no-ops).

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/Election.sol test/Election.t.sol && cd ..
git commit -m "feat(contracts): implement Election constructor and isAdmin (Dev B)"
```

---

## Task 2: Cluster 2 — Election lifecycle

**Files:**
- Modify: `contracts/src/Election.sol`
- Modify: `contracts/test/Election.t.sol`

- [ ] **Step 1: Add test helper and write the failing tests**

Open `contracts/test/Election.t.sol`. Add the helper function to the `ElectionTest` contract (add it right after the `setUp` function):

```solidity
/// @dev Creates election 0 with one candidate ("Alice"). Both admin actions.
function _createWithCandidate() internal returns (uint256 electionId) {
    vm.startPrank(admin);
    electionId = election.createElection("E", "desc");
    election.addCandidate(electionId, "Alice", "bio", "");
    vm.stopPrank();
}
```

Then fill in all 13 lifecycle test bodies:

```solidity
// ----- createElection ------------------------------------------------

function test_createElection_happyPath() public {
    vm.prank(admin);
    vm.expectEmit(true, true, false, true);
    emit Election.ElectionCreated(0, admin, "Test Election");
    uint256 id = election.createElection("Test Election", "A description");

    assertEq(id, 0);
    (
        uint256 eid,
        string memory name,
        string memory desc,
        address creator,
        Election.State state,
        uint256 cc,
        uint256 tv
    ) = election.getElection(0);
    assertEq(eid, 0);
    assertEq(name, "Test Election");
    assertEq(desc, "A description");
    assertEq(creator, admin);
    assertTrue(state == Election.State.NotStarted);
    assertEq(cc, 0);
    assertEq(tv, 0);
}

function test_createElection_revertsOnEmptyName() public {
    vm.prank(admin);
    vm.expectRevert(Election.EmptyName.selector);
    election.createElection("", "desc");
}

function test_createElection_revertsWhenNonAdmin() public {
    vm.prank(other);
    vm.expectRevert();
    election.createElection("E", "desc");
}

function test_createElection_incrementsElectionCount() public {
    vm.startPrank(admin);
    election.createElection("E1", "d");
    election.createElection("E2", "d");
    vm.stopPrank();
    assertEq(election.electionCount(), 2);
}

// ----- addCandidate --------------------------------------------------

function test_addCandidate_happyPath() public {
    vm.prank(admin);
    election.createElection("E", "desc");

    vm.prank(admin);
    vm.expectEmit(true, true, false, true);
    emit Election.CandidateAdded(0, 0, "Alice");
    uint256 candidateId = election.addCandidate(0, "Alice", "bio", "http://img.com/alice.jpg");

    assertEq(candidateId, 0);
    Election.Candidate memory c = election.getCandidate(0, 0);
    assertEq(c.id, 0);
    assertEq(c.name, "Alice");
    assertEq(c.description, "bio");
    assertEq(c.imageUrl, "http://img.com/alice.jpg");
    assertEq(c.voteCount, 0);
}

function test_addCandidate_revertsWhenStarted() public {
    uint256 eid = _createWithCandidate();
    vm.prank(admin);
    election.startElection(eid);

    vm.prank(admin);
    vm.expectRevert(Election.ElectionAlreadyStarted.selector);
    election.addCandidate(eid, "Bob", "bio", "");
}

function test_addCandidate_revertsWhenNonAdmin() public {
    vm.prank(admin);
    election.createElection("E", "desc");

    vm.prank(other);
    vm.expectRevert();
    election.addCandidate(0, "Alice", "bio", "");
}

function test_addCandidate_revertsOnEmptyName() public {
    vm.prank(admin);
    election.createElection("E", "desc");

    vm.prank(admin);
    vm.expectRevert(Election.EmptyName.selector);
    election.addCandidate(0, "", "bio", "");
}

// ----- lifecycle -----------------------------------------------------

function test_startElection_happyPath() public {
    uint256 eid = _createWithCandidate();

    vm.prank(admin);
    vm.expectEmit(true, false, false, false);
    emit Election.ElectionStarted(eid);
    election.startElection(eid);

    (, , , , Election.State state, , ) = election.getElection(eid);
    assertTrue(state == Election.State.Open);
}

function test_startElection_revertsWithoutCandidates() public {
    vm.prank(admin);
    election.createElection("E", "desc");

    vm.prank(admin);
    vm.expectRevert(Election.NoCandidates.selector);
    election.startElection(0);
}

function test_startElection_revertsWhenAlreadyStarted() public {
    uint256 eid = _createWithCandidate();
    vm.prank(admin);
    election.startElection(eid);

    vm.prank(admin);
    vm.expectRevert(Election.ElectionAlreadyStarted.selector);
    election.startElection(eid);
}

function test_endElection_happyPath() public {
    uint256 eid = _createWithCandidate();
    vm.prank(admin);
    election.startElection(eid);

    vm.prank(admin);
    vm.expectEmit(true, false, false, false);
    emit Election.ElectionEnded(eid);
    election.endElection(eid);

    (, , , , Election.State state, , ) = election.getElection(eid);
    assertTrue(state == Election.State.Ended);
}

function test_endElection_revertsWhenNotOpen() public {
    vm.prank(admin);
    election.createElection("E", "desc");

    vm.prank(admin);
    vm.expectRevert(Election.ElectionNotOpen.selector);
    election.endElection(0);
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest --match-test "test_create|test_add|test_start|test_end" -vv && cd ..
```
Expected: all 13 tests FAIL — functions revert with `TODO()` or return zero values.

- [ ] **Step 3: Implement Election.sol — lifecycle functions + three basic getters**

The lifecycle tests call `getElection` and `getCandidate` in their assertions, so implement those in this same task. Replace **seven** function bodies in `contracts/src/Election.sol`:

**Basic getters (needed by lifecycle tests):**

**`getElection`:**
```solidity
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
    ElectionData storage e = _election(electionId);
    return (e.id, e.name, e.description, e.creator, e.state, e.candidateCount, e.totalVotes);
}
```

**`getCandidate`:**
```solidity
function getCandidate(uint256 electionId, uint256 candidateId)
    external
    view
    returns (Candidate memory)
{
    ElectionData storage e = _election(electionId);
    if (candidateId >= e.candidateCount) revert CandidateNotFound();
    return e.candidates[candidateId];
}
```

**`getCandidateCount`:**
```solidity
function getCandidateCount(uint256 electionId) external view returns (uint256) {
    return _election(electionId).candidateCount;
}
```

**Lifecycle functions:**

**`createElection`:**
```solidity
function createElection(string calldata name, string calldata description)
    external
    onlyRole(ADMIN_ROLE)
    returns (uint256 electionId)
{
    if (bytes(name).length == 0) revert EmptyName();
    electionId = electionCount++;
    // Access _elections directly here (NOT via _election helper) because
    // the slot only becomes valid after electionCount is incremented above.
    ElectionData storage e = _elections[electionId];
    e.id          = electionId;
    e.name        = name;
    e.description = description;
    e.creator     = msg.sender;
    e.state       = State.NotStarted;
    emit ElectionCreated(electionId, msg.sender, name);
}
```

**`addCandidate`:**
```solidity
function addCandidate(
    uint256 electionId,
    string calldata name,
    string calldata description,
    string calldata imageUrl
) external onlyRole(ADMIN_ROLE) returns (uint256 candidateId) {
    ElectionData storage e = _election(electionId);
    if (e.state == State.Open)   revert ElectionAlreadyStarted();
    if (e.state == State.Ended)  revert ElectionAlreadyEnded();
    if (bytes(name).length == 0) revert EmptyName();
    candidateId = e.candidateCount++;
    e.candidates[candidateId] = Candidate(candidateId, name, description, imageUrl, 0);
    emit CandidateAdded(electionId, candidateId, name);
}
```

**`startElection`:**
```solidity
function startElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
    ElectionData storage e = _election(electionId);
    if (e.state != State.NotStarted) revert ElectionAlreadyStarted();
    if (e.candidateCount == 0)       revert NoCandidates();
    e.state = State.Open;
    emit ElectionStarted(electionId);
}
```

**`endElection`:**
```solidity
function endElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
    ElectionData storage e = _election(electionId);
    if (e.state != State.Open) revert ElectionNotOpen();
    e.state = State.Ended;
    emit ElectionEnded(electionId);
}
```

Also remove the `/* onlyRole(ADMIN_ROLE) */` comment wrappers — the modifiers are now active.

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest -vv && cd ..
```
Expected: all 17 tests pass (4 constructor + 13 lifecycle). Empty tests still pass trivially.

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/Election.sol test/Election.t.sol && cd ..
git commit -m "feat(contracts): implement election lifecycle (Dev B)"
```

---

## Task 3: Cluster 3 — Vote

**Files:**
- Modify: `contracts/src/Election.sol`
- Modify: `contracts/test/Election.t.sol`

- [ ] **Step 1: Write the failing tests**

Fill in the 5 vote test bodies in `contracts/test/Election.t.sol`:

```solidity
function test_vote_happyPath() public {
    uint256 eid = _createWithCandidate();
    registry.setAuthorized(eid, voter1, true);
    vm.prank(admin);
    election.startElection(eid);

    vm.prank(voter1);
    vm.expectEmit(true, true, true, false);
    emit Election.VoteCast(eid, 0, voter1);
    election.vote(eid, 0);

    Election.Candidate memory c = election.getCandidate(eid, 0);
    assertEq(c.voteCount, 1);
    (, , , , , , uint256 totalVotes) = election.getElection(eid);
    assertEq(totalVotes, 1);
}

function test_vote_revertsWhenNotOpen() public {
    uint256 eid = _createWithCandidate();
    registry.setAuthorized(eid, voter1, true);

    // Case 1: NotStarted
    vm.prank(voter1);
    vm.expectRevert(Election.ElectionNotOpen.selector);
    election.vote(eid, 0);

    // Case 2: Ended
    vm.startPrank(admin);
    election.startElection(eid);
    election.endElection(eid);
    vm.stopPrank();

    vm.prank(voter1);
    vm.expectRevert(Election.ElectionNotOpen.selector);
    election.vote(eid, 0);
}

function test_vote_revertsWhenNotAuthorized() public {
    uint256 eid = _createWithCandidate();
    vm.prank(admin);
    election.startElection(eid);

    // voter1 is NOT authorized
    vm.prank(voter1);
    vm.expectRevert(Election.VoterNotAuthorized.selector);
    election.vote(eid, 0);
}

function test_vote_revertsWhenAlreadyVoted() public {
    uint256 eid = _createWithCandidate();
    registry.setAuthorized(eid, voter1, true);
    vm.prank(admin);
    election.startElection(eid);

    vm.prank(voter1);
    election.vote(eid, 0);

    vm.prank(voter1);
    vm.expectRevert(Election.AlreadyVoted.selector);
    election.vote(eid, 0);
}

function test_vote_revertsOnUnknownCandidate() public {
    uint256 eid = _createWithCandidate();
    registry.setAuthorized(eid, voter1, true);
    vm.prank(admin);
    election.startElection(eid);

    vm.prank(voter1);
    vm.expectRevert(Election.CandidateNotFound.selector);
    election.vote(eid, 999);
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest --match-test "test_vote" -vv && cd ..
```
Expected: all 5 fail — `vote()` reverts with `TODO()`.

- [ ] **Step 3: Implement `vote` in Election.sol**

Replace the `vote` function body:

```solidity
function vote(uint256 electionId, uint256 candidateId) external {
    ElectionData storage e = _election(electionId);
    if (e.state != State.Open)                           revert ElectionNotOpen();
    if (!registry.isAuthorized(electionId, msg.sender))  revert VoterNotAuthorized();
    if (e.hasVoted[msg.sender])                          revert AlreadyVoted();
    if (candidateId >= e.candidateCount)                 revert CandidateNotFound();
    e.hasVoted[msg.sender] = true;
    e.candidates[candidateId].voteCount++;
    e.totalVotes++;
    emit VoteCast(electionId, candidateId, msg.sender);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest -vv && cd ..
```
Expected: 22 tests pass (4 + 13 + 5). Empty view/concurrent tests still pass trivially.

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/Election.sol test/Election.t.sol && cd ..
git commit -m "feat(contracts): implement vote (Dev B)"
```

---

## Task 4: Cluster 4 — Complex views + concurrent isolation

**Files:**
- Modify: `contracts/src/Election.sol`
- Modify: `contracts/test/Election.t.sol`

Note: `getElection`, `getCandidate`, and `getCandidateCount` were implemented in Task 2 (they were needed for lifecycle test assertions). This task covers the remaining two views: `getResults` and `getWinner`.

- [ ] **Step 1: Write the failing tests**

Fill in the 5 view + concurrent tests in `contracts/test/Election.t.sol`:

```solidity
function test_getResults_returnsAllCandidates() public {
    vm.startPrank(admin);
    election.createElection("E", "desc");
    election.addCandidate(0, "Alice", "bio1", "http://a.com/a.jpg");
    election.addCandidate(0, "Bob",   "bio2", "http://a.com/b.jpg");
    vm.stopPrank();

    Election.Candidate[] memory results = election.getResults(0);
    assertEq(results.length, 2);
    assertEq(results[0].name, "Alice");
    assertEq(results[1].name, "Bob");
    assertEq(results[0].id, 0);
    assertEq(results[1].id, 1);
}

function test_getWinner_revertsWhenNotEnded() public {
    uint256 eid = _createWithCandidate();
    vm.prank(admin);
    election.startElection(eid);

    vm.expectRevert(Election.ElectionNotEnded.selector);
    election.getWinner(eid);
}

function test_getWinner_revertsOnNoVotes() public {
    uint256 eid = _createWithCandidate();
    vm.startPrank(admin);
    election.startElection(eid);
    election.endElection(eid);
    vm.stopPrank();

    vm.expectRevert(Election.NoVotesCast.selector);
    election.getWinner(eid);
}

function test_getWinner_tiebreakByLowestId() public {
    vm.startPrank(admin);
    uint256 eid = election.createElection("E", "desc");
    election.addCandidate(eid, "Alice", "", "");  // id = 0
    election.addCandidate(eid, "Bob",   "", "");  // id = 1
    election.startElection(eid);
    vm.stopPrank();

    registry.setAuthorized(eid, voter1, true);
    registry.setAuthorized(eid, voter2, true);

    vm.prank(voter1);
    election.vote(eid, 0);   // Alice: 1 vote
    vm.prank(voter2);
    election.vote(eid, 1);   // Bob: 1 vote — tie

    vm.prank(admin);
    election.endElection(eid);

    Election.Candidate memory winner = election.getWinner(eid);
    assertEq(winner.id,   0);
    assertEq(winner.name, "Alice");
}

function test_multipleElections_isolatedState() public {
    vm.startPrank(admin);
    uint256 eid0 = election.createElection("E0", "d");
    election.addCandidate(eid0, "Alice",   "", "");
    election.startElection(eid0);

    uint256 eid1 = election.createElection("E1", "d");
    election.addCandidate(eid1, "Charlie", "", "");
    election.startElection(eid1);
    vm.stopPrank();

    registry.setAuthorized(eid0, voter1, true);
    // voter1 is NOT authorized for eid1

    vm.prank(voter1);
    election.vote(eid0, 0);

    (, , , , , , uint256 tv0) = election.getElection(eid0);
    (, , , , , , uint256 tv1) = election.getElection(eid1);
    assertEq(tv0, 1);
    assertEq(tv1, 0);
}
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
cd contracts && forge test --match-contract ElectionTest --match-test "test_get|test_multiple" -vv && cd ..
```
Expected: 5 fail — views return zero/empty values, `getWinner` doesn't revert on wrong state yet.

- [ ] **Step 3: Implement the two remaining view functions in Election.sol**

**`getResults`:**
```solidity
function getResults(uint256 electionId) external view returns (Candidate[] memory) {
    ElectionData storage e = _election(electionId);
    Candidate[] memory result = new Candidate[](e.candidateCount);
    for (uint256 i = 0; i < e.candidateCount; i++) {
        result[i] = e.candidates[i];
    }
    return result;
}
```

**`getWinner`:**
```solidity
function getWinner(uint256 electionId) external view returns (Candidate memory) {
    ElectionData storage e = _election(electionId);
    if (e.state != State.Ended) revert ElectionNotEnded();
    if (e.totalVotes == 0)      revert NoVotesCast();
    Candidate memory winner = e.candidates[0];
    for (uint256 i = 1; i < e.candidateCount; i++) {
        // strictly greater — ties keep the first (lowest id) candidate
        if (e.candidates[i].voteCount > winner.voteCount) {
            winner = e.candidates[i];
        }
    }
    return winner;
}
```

Also remove `error TODO();` from the errors section — all TODO sentinels are gone.

- [ ] **Step 4: Run full test suite — all 27 must pass**

Run:
```bash
cd contracts && forge test -vv && cd ..
```
Expected: `27 tests passed` in ElectionTest, 16 tests in VoterRegistryTest (whatever state Dev A left them — they should still pass). Zero failures.

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add src/Election.sol test/Election.t.sol && cd ..
git commit -m "feat(contracts): implement Election views (Dev B)"
```

---

## Task 5: Deploy script

**Files:**
- Modify: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Implement `_parseSeedAdmins`**

Replace the `_parseSeedAdmins` body in `contracts/script/Deploy.s.sol`:

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

`vm.envAddress(key, delimiter)` (Foundry ≥ 0.2.0) handles CSV natively. The `try/catch` covers both "env var not set" and "empty string" without manual parsing.

- [ ] **Step 2: Implement `run()`**

Replace the `run()` body:

```solidity
function run() external returns (VoterRegistry registry, Election election) {
    uint256 pk       = vm.envUint("PRIVATE_KEY");
    address deployer = vm.addr(pk);
    address[] memory admins = _parseSeedAdmins(deployer);

    vm.startBroadcast(pk);
    registry = new VoterRegistry(admins);
    election  = new Election(address(registry), admins);
    vm.stopBroadcast();

    console2.log("VoterRegistry:", address(registry));
    console2.log("Election:     ", address(election));
}
```

- [ ] **Step 3: Verify the script compiles**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: `Compiler run successful!`

- [ ] **Step 4: Smoke-test deploy on local anvil**

Open a separate terminal and start anvil:
```bash
cd contracts && anvil
```

In the original terminal, deploy:
```bash
cd contracts && PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast && cd ..
```
Expected: console output shows two non-zero addresses for VoterRegistry and Election. No revert.

Stop anvil (Ctrl-C in that terminal).

- [ ] **Step 5: Commit**

Run:
```bash
cd contracts && git add script/Deploy.s.sol && cd ..
git commit -m "feat(contracts): implement Deploy script (Dev B)"
```

---

## Task 6: Final verification

No new files.

- [ ] **Step 1: Full forge test**

Run:
```bash
cd contracts && forge test -vv && cd ..
```
Expected: all tests pass, zero failures.

- [ ] **Step 2: Confirm git log**

Run:
```bash
git log --oneline
```
Expected: at least 5 new commits on top of the scaffold baseline, one per task.
