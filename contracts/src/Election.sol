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

    mapping(uint256 => ElectionData) private _elections;

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev Validates electionId and returns a storage pointer. Used by every
    ///      function that reads or mutates an existing election.
    function _election(uint256 id) private view returns (ElectionData storage e) {
        if (id >= electionCount) revert ElectionNotFound();
        e = _elections[id];
    }

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
        require(registryAddress != address(0), "Election: zero registry");
        registry = IVoterRegistry(registryAddress);
        if (initialAdmins.length == 0) revert NotAdmin();
        for (uint256 i = 0; i < initialAdmins.length; i++) {
            _grantRole(DEFAULT_ADMIN_ROLE, initialAdmins[i]);
            _grantRole(ADMIN_ROLE, initialAdmins[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Admin — election lifecycle
    // ---------------------------------------------------------------------

    /// @notice Create a new election. Returns the new election id (also `electionCount - 1`).
    function createElection(string calldata name, string calldata description)
        external
        onlyRole(ADMIN_ROLE)
        returns (uint256 electionId)
    {
        if (bytes(name).length == 0) revert EmptyName();
        electionId = electionCount++;
        ElectionData storage e = _elections[electionId];
        e.id          = electionId;
        e.name        = name;
        e.description = description;
        e.creator     = msg.sender;
        e.state       = State.NotStarted;
        emit ElectionCreated(electionId, msg.sender, name);
    }

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

    function startElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
        ElectionData storage e = _election(electionId);
        if (e.state != State.NotStarted) revert ElectionAlreadyStarted();
        if (e.candidateCount == 0)       revert NoCandidates();
        e.state = State.Open;
        emit ElectionStarted(electionId);
    }

    function endElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
        ElectionData storage e = _election(electionId);
        if (e.state != State.Open) revert ElectionNotOpen();
        e.state = State.Ended;
        emit ElectionEnded(electionId);
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
        ElectionData storage e = _election(electionId);
        return (e.id, e.name, e.description, e.creator, e.state, e.candidateCount, e.totalVotes);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        returns (Candidate memory)
    {
        ElectionData storage e = _election(electionId);
        if (candidateId >= e.candidateCount) revert CandidateNotFound();
        return e.candidates[candidateId];
    }

    function getCandidateCount(uint256 electionId) external view returns (uint256) {
        return _election(electionId).candidateCount;
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
        return hasRole(ADMIN_ROLE, account);
    }
}
