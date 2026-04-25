// Voter flow: pick an Open election → see candidates → cast vote.
// Spec §5.3.
import { useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import ElectionSelector from '../components/ElectionSelector.jsx';

export default function VotePage() {
  const { ready } = useContract();
  const [electionId, setElectionId] = useState(null);

  if (!ready) return <p>Connect a wallet to continue.</p>;

  return (
    <div className="vote-page">
      <h2>Cast your vote</h2>
      <ElectionSelector
        value={electionId}
        onChange={setElectionId}
        // TODO(Dev B): filter={e => e.state === State.Open}
      />

      {/* TODO(Dev B):
          - If electionId is null → prompt to select.
          - Otherwise fetch candidates for electionId and render <CandidateCard> grid.
          - Disable Vote button if: !registry.isAuthorized(electionId, address) OR election.hasVoted (derive from past VoteCast events or a dedicated view).
          - On Vote: election.vote(electionId, candidateId); show pending/confirmed.
      */}
      <p>TODO: candidate list + vote action</p>
    </div>
  );
}
