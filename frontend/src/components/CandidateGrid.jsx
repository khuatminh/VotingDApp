import React from 'react';
import CandidateGridCard from './CandidateGridCard';

export default function CandidateGrid({
  candidates, votedCandidateId, disabled, onVote, onSelect,
}) {
  if (!candidates || candidates.length === 0) {
    return <p style={{ color: 'var(--ink-3)' }}>Chưa có ứng viên nào.</p>;
  }
  return (
    <div className="candidate-grid">
      {candidates.map(c => (
        <CandidateGridCard
          key={c.id}
          candidate={c}
          voted={c.id === votedCandidateId}
          disabled={disabled}
          onVote={onVote}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
