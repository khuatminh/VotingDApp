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
