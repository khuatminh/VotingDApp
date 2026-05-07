import React, { useEffect } from 'react';

const AVATAR_COLORS = ['#7c5cff', '#ff5cf2', '#3d9fef', '#c2ff3d', '#ff9f3d'];

export default function CandidateDetailModal({
  candidate, voted, disabled, onVote, onClose,
}) {
  useEffect(() => {
    if (!candidate) return;
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [candidate, onClose]);

  if (!candidate) return null;
  const color = AVATAR_COLORS[Number(candidate.id) % AVATAR_COLORS.length];

  function handleVote() {
    onVote?.(candidate.id);
    onClose?.();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal__close" type="button" onClick={onClose} aria-label="Đóng">×</button>
        <div className="modal__head">
          {candidate.imageUrl ? (
            <img src={candidate.imageUrl} alt={candidate.name} className="modal__avatar" />
          ) : (
            <div className="modal__avatar modal__avatar--fallback" style={{ background: color }}>👤</div>
          )}
          <div>
            <div className="modal__name">{candidate.name}</div>
            {candidate.slogan && (
              <div className="modal__slogan">"{candidate.slogan}"</div>
            )}
            <div className="modal__count">
              {candidate.voteCount} vote{candidate.voteCount !== 1 ? 's' : ''} so far
            </div>
          </div>
        </div>

        {candidate.bio && (
          <div className="modal__section">
            <div className="eyebrow mb-12">Tiểu sử</div>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{candidate.bio}</p>
          </div>
        )}

        {candidate.description && (
          <div className="modal__section">
            <div className="eyebrow mb-12">Mô tả</div>
            <p style={{ margin: 0 }}>{candidate.description}</p>
          </div>
        )}

        <div className="modal__footer">
          {voted ? (
            <span className="candidate-card__voted">Đã bỏ phiếu ✓</span>
          ) : (
            <button
              className="btn btn-accent"
              type="button"
              onClick={handleVote}
              disabled={disabled}
            >
              Bỏ phiếu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
