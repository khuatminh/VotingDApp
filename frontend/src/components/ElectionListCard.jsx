import React from 'react';
import { useNavigate } from 'react-router-dom';

const STATE_LABELS = { 0: 'NotStarted', 1: 'Open', 2: 'Ended' };

function StateBadge({ state }) {
  const label = STATE_LABELS[state] ?? 'NotStarted';
  const cls =
    state === 1 ? 'badge-open' :
    state === 2 ? 'badge-ended' : 'badge-notstarted';
  return (
    <span className={`badge ${cls}`}>
      <span className="dot"></span>
      {label === 'NotStarted' ? 'Not started' : label}
    </span>
  );
}

export default function ElectionListCard({ election }) {
  const navigate = useNavigate();
  const { id, name, description, state, candidateCount, totalVotes } = election;

  function handleClick(e) {
    if (e.target.closest('a')) return; // let the "view results" link through
    navigate(`/vote/${id}`);
  }

  return (
    <div
      className="row-card election-list-card"
      onClick={handleClick}
      style={{ cursor: 'pointer', display: 'block' }}
    >
      <div className="row-h gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="title">{name}</span>
        <StateBadge state={state} />
      </div>
      {description && (
        <div className="sub" style={{ marginTop: 6 }}>{description}</div>
      )}
      <div className="sub" style={{ marginTop: 8, fontSize: 12 }}>
        📊 {totalVotes} vote{totalVotes !== 1 ? 's' : ''} ·{' '}
        👥 {candidateCount} candidate{candidateCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
