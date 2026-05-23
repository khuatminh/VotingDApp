import React, { useState } from 'react';
import { ipfsToHttp } from '../lib/ipfs.js';

const AVATAR_COLORS = ['#7c5cff', '#ff5cf2', '#3d9fef', '#c2ff3d', '#ff9f3d'];

export default function CandidateGridCard({
  candidate, voted, disabled, onVote, onSelect,
}) {
  const [imgError, setImgError] = useState(false);
  if (!candidate) return null;
  const avatarColor = AVATAR_COLORS[Number(candidate.id) % AVATAR_COLORS.length];
  const showImg = candidate.imageUrl && !imgError;

  function handleVoteClick(e) {
    e.stopPropagation();
    onVote?.(candidate.id);
  }

  return (
    <div
      className={`candidate-card${voted ? ' voted' : ''}`}
      onClick={() => onSelect?.(candidate.id)}
    >
      {showImg ? (
        <img
          src={ipfsToHttp(candidate.imageUrl)}
          alt={candidate.name}
          onError={() => setImgError(true)}
          className="candidate-card__avatar"
        />
      ) : (
        <div className="candidate-card__avatar candidate-card__avatar--fallback"
          style={{ background: avatarColor }}>👤</div>
      )}
      <div className="candidate-card__name">{candidate.name}</div>
      {candidate.slogan && (
        <div className="candidate-card__slogan">"{candidate.slogan}"</div>
      )}
      <div className="candidate-card__action">
        {voted ? (
          <span className="candidate-card__voted">Đã bỏ phiếu ✓</span>
        ) : (
          <button
            className="btn btn-accent btn-sm"
            type="button"
            onClick={handleVoteClick}
            disabled={disabled}
          >
            Bỏ phiếu
          </button>
        )}
      </div>
    </div>
  );
}
