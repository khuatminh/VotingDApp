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
        address[] memory admins = new address[](1);
        admins[0] = admin;
        registry = new VoterRegistry(admins);
    }

    // ----- constructor ---------------------------------------------------

    function test_constructor_revertsOnEmptyAdminList() public {
        vm.expectRevert(IVoterRegistry.NotAdmin.selector);
        new VoterRegistry(new address[](0));
    }
    function test_constructor_revertsOnZeroAdmin()     public {
        // zero at index 1
        address[] memory admins = new address[](2);
        admins[0] = admin;
        admins[1] = address(0);
        vm.expectRevert(IVoterRegistry.ZeroAddress.selector);
        new VoterRegistry(admins);

        // zero at index 0
        address[] memory admins2 = new address[](1);
        admins2[0] = address(0);
        vm.expectRevert(IVoterRegistry.ZeroAddress.selector);
        new VoterRegistry(admins2);
    }
    function test_constructor_grantsRolesToSeedAdmins() public {
        assertTrue(registry.isAdmin(admin));
        assertFalse(registry.isAdmin(other));
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
    }

    // ----- authorizeVoter ------------------------------------------------

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

    // ----- revokeVoter ---------------------------------------------------

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

    // ----- authorizeVoters (batch) --------------------------------------

    function test_authorizeVoters_happyPath()         public { /* TODO(Dev A) */ }
    function test_authorizeVoters_revertsOnFirstZeroAddress()    public { /* TODO(Dev A) */ }
    function test_authorizeVoters_revertsOnFirstDuplicate()      public { /* TODO(Dev A) */ }

    // ----- role administration (inherited from AccessControl) ----------

    function test_grantRole_byDefaultAdmin()          public {
        bytes32 role = registry.ADMIN_ROLE();
        vm.prank(admin);
        registry.grantRole(role, other);
        assertTrue(registry.isAdmin(other));
    }
    function test_revokeRole_byDefaultAdmin()         public {
        bytes32 role = registry.ADMIN_ROLE();
        vm.prank(admin);
        registry.revokeRole(role, admin);
        assertFalse(registry.isAdmin(admin));
    }
    function test_isAdmin_reflectsRoleState()         public {
        assertFalse(registry.isAdmin(other));
        bytes32 role = registry.ADMIN_ROLE();
        vm.prank(admin);
        registry.grantRole(role, other);
        assertTrue(registry.isAdmin(other));
    }

    // ----- per-election isolation ---------------------------------------

    function test_isAuthorized_isPerElection()        public { /* TODO(Dev A): authorize for 0, not 1 */ }
}
