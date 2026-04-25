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
