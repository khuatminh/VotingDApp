// frontend/src/components/CandidateCard.jsx
import React, { useState } from 'react'

const AVATAR_COLORS = ['#7c5cff', '#ff5cf2', '#3d9fef', '#c2ff3d', '#ff9f3d']

export default function CandidateCard({ candidate, onVote, voted, disabled }) {
  const [imgError, setImgError] = useState(false)
  const avatarColor = AVATAR_COLORS[Number(candidate.id) % AVATAR_COLORS.length]
  const showImg = candidate.imageUrl && !imgError

  return (
    <div className="row-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {showImg ? (
        <img
          src={candidate.imageUrl}
          alt={candidate.name}
          onError={() => setImgError(true)}
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: avatarColor, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          👤
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
          {candidate.name}
        </div>
        <div style={{
          color: '#888', fontSize: '0.8rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {candidate.description}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {voted ? (
          <span style={{ color: '#c2ff3d', fontSize: '0.85rem', fontWeight: 'bold' }}>
            Đã bỏ phiếu ✓
          </span>
        ) : (
          <button className="btn btn-accent" onClick={onVote} disabled={disabled}>
            Bỏ phiếu
          </button>
        )}
      </div>
    </div>
  )
}
