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

    /// @dev Creates election 0 with one candidate ("Alice"). Both admin actions.
    function _createWithCandidate() internal returns (uint256 electionId) {
        vm.startPrank(admin);
        electionId = election.createElection("E", "desc");
        election.addCandidate(electionId, "Alice", "bio", "");
        vm.stopPrank();
    }

    // ----- createElection -----------------------------------------------

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

    // ----- vote ----------------------------------------------------------

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

    // ----- views ---------------------------------------------------------

    function test_getResults_returnsAllCandidates()       public { /* TODO(Dev B) */ }
    function test_getWinner_revertsWhenNotEnded()         public { /* TODO(Dev B): ElectionNotEnded */ }
    function test_getWinner_revertsOnNoVotes()            public { /* TODO(Dev B): NoVotesCast */ }
    function test_getWinner_tiebreakByLowestId()          public { /* TODO(Dev B) */ }

    // ----- concurrent elections -----------------------------------------

    function test_multipleElections_isolatedState()       public { /* TODO(Dev B): vote in 0 ≠ vote in 1 */ }
}
