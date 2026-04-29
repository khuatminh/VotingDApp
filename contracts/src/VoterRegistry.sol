// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IVoterRegistry} from "./interfaces/IVoterRegistry.sol";

/// @title VoterRegistry
/// @author Dev A
/// @notice Per-election voter authorization, guarded by role-based access control.
/// @dev Partially implemented. `revokeVoter` and `authorizeVoters` still revert `TODO()`.
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

    mapping(uint256 => mapping(address => bool)) private _authorized;

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
        if (initialAdmins.length == 0) revert NotAdmin();
        for (uint256 i = 0; i < initialAdmins.length; i++) {
            if (initialAdmins[i] == address(0)) revert ZeroAddress();
            _grantRole(DEFAULT_ADMIN_ROLE, initialAdmins[i]);
            _grantRole(ADMIN_ROLE, initialAdmins[i]);
        }
    }

    // ---------------------------------------------------------------------
    // External — voter authorization (per election)
    // ---------------------------------------------------------------------

    /// @inheritdoc IVoterRegistry
    function authorizeVoter(uint256 electionId, address voter)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (voter == address(0)) revert ZeroAddress();
        if (_authorized[electionId][voter]) revert AlreadyAuthorized();
        _authorized[electionId][voter] = true;
        emit VoterAuthorized(electionId, voter, msg.sender);
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
        return _authorized[electionId][voter];
    }

    // ---------------------------------------------------------------------
    // Admin-role helpers (thin wrapper for frontend convenience)
    // ---------------------------------------------------------------------

    /// @notice Returns true if `account` currently holds ADMIN_ROLE.
    /// @dev Thin wrapper over AccessControl.hasRole so the frontend can call one well-named view.
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
}
