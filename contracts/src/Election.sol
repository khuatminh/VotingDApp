// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IVoterRegistry} from "./interfaces/IVoterRegistry.sol";

/// @title Election
/// @author Dev B
/// @notice Manages multiple concurrent elections with richer candidates and per-election
///         voter authorization (delegated to IVoterRegistry). Symmetric admins; creator
///         tracked for auditing only ("Model 3" — see spec §3.4).
/// @dev SKELETON. All mutating bodies revert `TODO()`; all views return zero/empty.
///      Spec: docs/superpowers/specs/2026-04-25-voting-dapp-design.md §4.3
contract Election is AccessControl {
    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------

    /// @dev keccak256("ADMIN_ROLE")
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum State { NotStarted, Open, Ended }

    struct Candidate {
        uint256 id;
        string  name;
        string  description;
        string  imageUrl;
        uint256 voteCount;
    }

    struct ElectionData {
        uint256 id;
        string  name;
        string  description;
        address creator;        // audit-only, never used for authz
        State   state;
        uint256 candidateCount;
        uint256 totalVotes;
        mapping(uint256 => Candidate) candidates;
        mapping(address => bool)       hasVoted;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice External voter-authorization source. Immutable after deploy.
    IVoterRegistry public immutable registry;

    /// @notice Number of elections ever created. Also used as the next election id.
    uint256 public electionCount;

    // TODO(Dev B): mapping(uint256 => ElectionData) private _elections;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ElectionCreated(uint256 indexed electionId, address indexed creator, string name);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error TODO();              // skeleton sentinel
    error NotAdmin();
    error ElectionNotFound();
    error ElectionNotOpen();
    error ElectionNotEnded();
    error ElectionAlreadyStarted();
    error ElectionAlreadyEnded();
    error AlreadyVoted();
    error VoterNotAuthorized();
    error CandidateNotFound();
    error NoCandidates();
    error NoVotesCast();
    error EmptyName();

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param registryAddress Deployed VoterRegistry address.
    /// @param initialAdmins   Seeded with DEFAULT_ADMIN_ROLE + ADMIN_ROLE. Must be non-empty.
    constructor(address registryAddress, address[] memory initialAdmins) {
        // TODO(Dev B):
        //   1. require registryAddress != address(0)
        //   2. registry = IVoterRegistry(registryAddress);  // note: immutable, must set here
        //   3. require initialAdmins.length > 0
        //   4. for each admin: _grantRole(DEFAULT_ADMIN_ROLE, admin) and _grantRole(ADMIN_ROLE, admin)
        registry = IVoterRegistry(registryAddress);
        initialAdmins;
    }

    // ---------------------------------------------------------------------
    // Admin — election lifecycle
    // ---------------------------------------------------------------------

    /// @notice Create a new election. Returns the new election id (also `electionCount - 1`).
    function createElection(string calldata name, string calldata description)
        external
        /* onlyRole(ADMIN_ROLE) */
        returns (uint256 electionId)
    {
        // TODO(Dev B):
        //   - require bytes(name).length > 0 (EmptyName)
        //   - electionId = electionCount++;
        //   - init _elections[electionId] fields (id, name, description, creator=msg.sender, state=NotStarted)
        //   - emit ElectionCreated
        name; description;
        revert TODO();
    }

    function addCandidate(
        uint256 electionId,
        string calldata name,
        string calldata description,
        string calldata imageUrl
    ) external /* onlyRole(ADMIN_ROLE) */ returns (uint256 candidateId) {
        // TODO(Dev B):
        //   - require election exists and state == NotStarted
        //   - require bytes(name).length > 0
        //   - candidateId = e.candidateCount++;
        //   - store Candidate, emit CandidateAdded
        electionId; name; description; imageUrl;
        revert TODO();
    }

    function startElection(uint256 electionId) external /* onlyRole(ADMIN_ROLE) */ {
        // TODO(Dev B): require state == NotStarted; require candidateCount > 0 (NoCandidates); set Open; emit.
        electionId;
        revert TODO();
    }

    function endElection(uint256 electionId) external /* onlyRole(ADMIN_ROLE) */ {
        // TODO(Dev B): require state == Open; set Ended; emit.
        electionId;
        revert TODO();
    }

    // ---------------------------------------------------------------------
    // Public — cast a vote
    // ---------------------------------------------------------------------

    function vote(uint256 electionId, uint256 candidateId) external {
        // TODO(Dev B):
        //   - require election exists and state == Open (ElectionNotOpen)
        //   - require registry.isAuthorized(electionId, msg.sender) (VoterNotAuthorized)
        //   - require !e.hasVoted[msg.sender] (AlreadyVoted)
        //   - require candidateId < e.candidateCount (CandidateNotFound)
        //   - e.hasVoted[msg.sender] = true;
        //   - e.candidates[candidateId].voteCount++;
        //   - e.totalVotes++;
        //   - emit VoteCast
        electionId; candidateId;
        revert TODO();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

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
        // TODO(Dev B): destructure _elections[electionId]; revert ElectionNotFound if id >= electionCount.
        electionId;
        return (0, "", "", address(0), State.NotStarted, 0, 0);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        returns (Candidate memory)
    {
        // TODO(Dev B): bounds-check, return e.candidates[candidateId].
        electionId; candidateId;
        return Candidate(0, "", "", "", 0);
    }

    function getCandidateCount(uint256 electionId) external view returns (uint256) {
        // TODO(Dev B): bounds-check, return e.candidateCount.
        electionId;
        return 0;
    }

    function getResults(uint256 electionId) external view returns (Candidate[] memory) {
        // TODO(Dev B): return all candidates for the election.
        electionId;
        return new Candidate[](0);
    }

    /// @notice Winner is the candidate with the highest voteCount. Ties broken by lowest candidateId.
    /// @dev Reverts ElectionNotEnded if state != Ended; reverts NoVotesCast if totalVotes == 0.
    function getWinner(uint256 electionId) external view returns (Candidate memory) {
        // TODO(Dev B): enforce state & totalVotes checks, then linear scan with tiebreak = lowest id.
        electionId;
        return Candidate(0, "", "", "", 0);
    }

    /// @notice Returns true if `account` holds ADMIN_ROLE.
    function isAdmin(address account) external view returns (bool) {
        // TODO(Dev B): return hasRole(ADMIN_ROLE, account);
        account;
        return false;
    }
}
