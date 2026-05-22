import React from 'react';
import { ipfsToHttp } from '../lib/ipfs.js';

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

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

const AVATAR_COLORS = ['#7c5cff', '#ff5cf2', '#3d9fef', '#c2ff3d', '#ff9f3d'];

function CandidateAvatar({ candidate, size = 24 }) {
  const [err, setErr] = React.useState(false);
  const color = AVATAR_COLORS[Number(candidate.id) % AVATAR_COLORS.length];
  if (candidate.imageUrl && !err) {
    return (
      <img
        src={ipfsToHttp(candidate.imageUrl)}
        alt={candidate.name}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size / 2,
    }}>👤</div>
  );
}

export default function ElectionDetailHeader({
  election,
  candidates,
  isAuthorized,
  votedCandidateId,
  walletConnected,
  onVotedClick,
}) {
  const votedCandidate = votedCandidateId !== null
    ? candidates.find(c => c.id === votedCandidateId)
    : null;

  const authStatus = !walletConnected
    ? '—'
    : isAuthorized === null
      ? '…'
      : isAuthorized ? '✓ OK' : '✗ Not authorized';

  const sortedForBars = [...candidates].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="row-h gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{election.name}</h2>
        <StateBadge state={election.state} />
      </div>
      {election.description && (
        <p style={{ color: 'var(--ink-3)', marginTop: 8 }}>{election.description}</p>
      )}

      <div className="stat-row">
        <StatTile label="Total votes" value={election.totalVotes} />
        <StatTile label="Candidates"  value={election.candidateCount} />
        <StatTile label="Your vote"
          value={votedCandidate ? '✓ Voted' : (walletConnected ? 'Not yet' : '—')} />
        <StatTile label="Auth status" value={authStatus} />
      </div>

      {votedCandidate && (
        <div
          className="your-vote-row"
          onClick={() => onVotedClick?.(votedCandidate.id)}
          style={{ cursor: onVotedClick ? 'pointer' : 'default' }}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Your vote:</span>
          <CandidateAvatar candidate={votedCandidate} size={28} />
          <span>{votedCandidate.name}</span>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div className="eyebrow mb-12">Live distribution</div>
        {election.totalVotes === 0 ? (
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No votes yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedForBars.map(c => {
              const pct = election.totalVotes > 0
                ? Math.round((c.voteCount / election.totalVotes) * 100)
                : 0;
              return (
                <div key={c.id} className="distribution-row">
                  <div className="name">{c.name}</div>
                  <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
                  <div className="pct">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
