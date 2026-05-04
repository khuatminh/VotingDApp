// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IVoterRegistry} from "./interfaces/IVoterRegistry.sol";

/// @title Election
/// @author Dev B
/// @notice Manages multiple concurrent elections with richer candidates and per-election
///         voter authorization (delegated to IVoterRegistry). Symmetric admins; creator
///         tracked for auditing only ("Model 3" — see spec §3.4).
/// @dev Spec: docs/superpowers/specs/2026-04-25-voting-dapp-design.md §4.3
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
        bool    deleted;
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
    event ElectionUpdated(uint256 indexed electionId, string name, string description);
    event ElectionRemoved(uint256 indexed electionId);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event CandidateUpdated(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event CandidateRemoved(uint256 indexed electionId, uint256 indexed candidateId);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

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
        if (e.deleted)               revert ElectionNotFound();
        if (e.state == State.Open)   revert ElectionAlreadyStarted();
        if (e.state == State.Ended)  revert ElectionAlreadyEnded();
        if (bytes(name).length == 0) revert EmptyName();
        candidateId = e.candidateCount++;
        e.candidates[candidateId] = Candidate(candidateId, name, description, imageUrl, 0);
        emit CandidateAdded(electionId, candidateId, name);
    }

    function updateElection(uint256 electionId, string calldata name, string calldata description)
        external onlyRole(ADMIN_ROLE)
    {
        if (bytes(name).length == 0) revert EmptyName();
        ElectionData storage e = _election(electionId);
        if (e.deleted) revert ElectionNotFound();
        e.name        = name;
        e.description = description;
        emit ElectionUpdated(electionId, name, description);
    }

    function deleteElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
        ElectionData storage e = _election(electionId);
        if (e.deleted)                   revert ElectionNotFound();
        if (e.state != State.NotStarted) revert ElectionAlreadyStarted();
        e.deleted = true;
        emit ElectionRemoved(electionId);
    }

    function updateCandidate(
        uint256 electionId,
        uint256 candidateId,
        string calldata name,
        string calldata description,
        string calldata imageUrl
    ) external onlyRole(ADMIN_ROLE) {
        if (bytes(name).length == 0) revert EmptyName();
        ElectionData storage e = _election(electionId);
        if (e.deleted) revert ElectionNotFound();
        if (candidateId >= e.candidateCount) revert CandidateNotFound();
        Candidate storage c = e.candidates[candidateId];
        c.name        = name;
        c.description = description;
        c.imageUrl    = imageUrl;
        emit CandidateUpdated(electionId, candidateId, name);
    }

    function deleteCandidate(uint256 electionId, uint256 candidateId)
        external onlyRole(ADMIN_ROLE)
    {
        ElectionData storage e = _election(electionId);
        if (e.deleted)                   revert ElectionNotFound();
        if (e.state != State.NotStarted) revert ElectionAlreadyStarted();
        if (candidateId >= e.candidateCount) revert CandidateNotFound();
        uint256 last = e.candidateCount - 1;
        if (candidateId != last) {
            Candidate storage lastCand = e.candidates[last];
            e.candidates[candidateId] = Candidate(candidateId, lastCand.name, lastCand.description, lastCand.imageUrl, 0);
        }
        delete e.candidates[last];
        e.candidateCount--;
        emit CandidateRemoved(electionId, candidateId);
    }

    function startElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
        ElectionData storage e = _election(electionId);
        if (e.deleted)                   revert ElectionNotFound();
        if (e.state != State.NotStarted) revert ElectionAlreadyStarted();
        if (e.candidateCount == 0)       revert NoCandidates();
        e.state = State.Open;
        emit ElectionStarted(electionId);
    }

    function endElection(uint256 electionId) external onlyRole(ADMIN_ROLE) {
        ElectionData storage e = _election(electionId);
        if (e.deleted)             revert ElectionNotFound();
        if (e.state != State.Open) revert ElectionNotOpen();
        e.state = State.Ended;
        emit ElectionEnded(electionId);
    }

    // ---------------------------------------------------------------------
    // Public — cast a vote
    // ---------------------------------------------------------------------

    function vote(uint256 electionId, uint256 candidateId) external {
        ElectionData storage e = _election(electionId);
        if (e.deleted)                                        revert ElectionNotFound();
        if (e.state != State.Open)                           revert ElectionNotOpen();
        if (!registry.isAuthorized(electionId, msg.sender))  revert VoterNotAuthorized();
        if (e.hasVoted[msg.sender])                          revert AlreadyVoted();
        if (candidateId >= e.candidateCount)                 revert CandidateNotFound();
        e.hasVoted[msg.sender] = true;
        e.candidates[candidateId].voteCount++;
        e.totalVotes++;
        emit VoteCast(electionId, candidateId, msg.sender);
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
            uint256 totalVotes,
            bool deleted
        )
    {
        ElectionData storage e = _election(electionId);
        return (e.id, e.name, e.description, e.creator, e.state, e.candidateCount, e.totalVotes, e.deleted);
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
        ElectionData storage e = _election(electionId);
        Candidate[] memory result = new Candidate[](e.candidateCount);
        for (uint256 i = 0; i < e.candidateCount; i++) {
            result[i] = e.candidates[i];
        }
        return result;
    }

    /// @notice Winner is the candidate with the highest voteCount. Ties broken by lowest candidateId.
    /// @dev Reverts ElectionNotEnded if state != Ended; reverts NoVotesCast if totalVotes == 0.
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

    /// @notice Returns true if `account` holds ADMIN_ROLE.
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
}
