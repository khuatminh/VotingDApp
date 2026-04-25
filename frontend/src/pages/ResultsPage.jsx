// Live results + winner view for a selected election.
// Spec §5.4.
import { useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import ElectionSelector from '../components/ElectionSelector.jsx';

export default function ResultsPage() {
  const { ready } = useContract();
  const [electionId, setElectionId] = useState(null);

  if (!ready) return <p>Connect a wallet to view results.</p>;

  return (
    <div className="results-page">
      <h2>Results</h2>
      <ElectionSelector value={electionId} onChange={setElectionId} />

      {/* TODO(Dev B):
          - If election state === NotStarted → "Election has not started."
          - If Open → live running totals via getResults(id); refresh on VoteCast event.
          - If Ended → highlight getWinner(id); display final tally.
      */}
      <p>TODO: results render by state</p>
    </div>
  );
}
