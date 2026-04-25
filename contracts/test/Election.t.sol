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
