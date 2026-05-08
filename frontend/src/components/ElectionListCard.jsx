import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const STATE_LABELS = { 0: 'NotStarted', 1: 'Open', 2: 'Ended' };
const PALETTE = ['#7c5cff', '#ff5cf2', '#3d9fef', '#c2ff3d', '#ff9f3d'];

function gradientFor(id) {
  const a = PALETTE[Number(id) % PALETTE.length];
  const b = PALETTE[(Number(id) + 2) % PALETTE.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

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
  const [imgError, setImgError] = useState(false);
  const { id, name, description, thumbnailUrl, state, candidateCount, totalVotes } = election;
  const showImg = thumbnailUrl && !imgError;

  function handleClick(e) {
    if (e.target.closest('a')) return;
    navigate(`/vote/${id}`);
  }

  return (
    <article className="election-card" onClick={handleClick}>
      <div className="election-card__thumb">
        {showImg ? (
          <img
            src={thumbnailUrl}
            alt={name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="election-card__thumb-fallback"
            style={{ background: gradientFor(id) }}
          />
        )}
      </div>
      <div className="election-card__body">
        <div className="row-h gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="title">{name}</span>
          <StateBadge state={state} />
        </div>
        {description && (
          <p className="election-card__desc">{description}</p>
        )}
        <div className="election-card__meta">
          📊 {totalVotes} vote{totalVotes !== 1 ? 's' : ''} ·{' '}
          👥 {candidateCount} candidate{candidateCount !== 1 ? 's' : ''}
        </div>
        {state === 2 && (
          <Link
            to="/results"
            style={{ color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}
          >
            View results →
          </Link>
        )}
      </div>
    </article>
  );
}
