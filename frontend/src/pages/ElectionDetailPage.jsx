import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useContract } from '../hooks/useContract';
import { useWallet } from '../hooks/useWallet';
import { useElectionDetail } from '../hooks/useElectionDetail';
import ElectionDetailHeader from '../components/ElectionDetailHeader';
import CandidateGrid from '../components/CandidateGrid';
import CandidateDetailModal from '../components/CandidateDetailModal';

const NOT_STARTED = 0, OPEN = 1, ENDED = 2;

export default function ElectionDetailPage({ pushToast, setPendingTx }) {
  const { id } = useParams();
  const { election: electionContract } = useContract();
  const { isConnected } = useWallet();
  const {
    election,
    candidates,
    isAuthorized,
    votedCandidateId,
    loading,
    error,
    reload,
  } = useElectionDetail(id);

  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

  async function handleVote(candidateId) {
    if (!election) return;
    setIsVoting(true);
    try {
      const tx = await electionContract.vote(election.id, candidateId);
      setPendingTx({ label: 'Bỏ phiếu', hash: tx.hash });
      await tx.wait();
      pushToast('Bỏ phiếu thành công!', 'success');
      await reload();
    } catch (err) {
      pushToast(err.reason ?? err.message, 'error');
    } finally {
      setIsVoting(false);
      setPendingTx(null);
    }
  }

  const selectedCandidate = selectedCandidateId !== null
    ? candidates.find(c => c.id === selectedCandidateId)
    : null;

  if (!isConnected) {
    return (
      <div className="container admin-page">
        <Link to="/vote" className="back-link">← Back to elections</Link>
        <p style={{ color: 'var(--ink-3)', marginTop: 32 }}>
          Kết nối ví để tham gia bỏ phiếu.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container admin-page">
        <Link to="/vote" className="back-link">← Back to elections</Link>
        <p style={{ color: 'var(--ink-3)', marginTop: 16 }}>Đang tải…</p>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="container admin-page">
        <Link to="/vote" className="back-link">← Back to elections</Link>
        <p style={{ color: '#f55', marginTop: 16 }}>
          {error || 'Election not found.'}
        </p>
      </div>
    );
  }

  const ended = election.state === ENDED;
  const notStarted = election.state === NOT_STARTED;
  const voteDisabled =
    !isAuthorized ||
    votedCandidateId !== null ||
    isVoting ||
    ended ||
    notStarted;

  return (
    <div className="container admin-page">
      <Link to="/vote" className="back-link">← Back to elections</Link>

      <ElectionDetailHeader
        election={election}
        candidates={candidates}
        isAuthorized={isAuthorized}
        votedCandidateId={votedCandidateId}
        walletConnected={isConnected}
        onVotedClick={setSelectedCandidateId}
      />

      {ended && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <span>
            Cuộc bầu cử đã kết thúc.{' '}
            <Link to="/results" style={{ color: 'var(--accent)' }}>Xem kết quả →</Link>
          </span>
        </div>
      )}

      {notStarted && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <span>Cuộc bầu cử chưa bắt đầu.</span>
        </div>
      )}

      {!notStarted && isAuthorized === false ? (
        <p style={{ color: 'var(--ink-3)' }}>
          Bạn không được ủy quyền tham gia cuộc bầu cử này.
        </p>
      ) : (
        <CandidateGrid
          candidates={candidates}
          votedCandidateId={votedCandidateId}
          disabled={voteDisabled}
          onVote={handleVote}
          onSelect={setSelectedCandidateId}
        />
      )}

      <CandidateDetailModal
        candidate={selectedCandidate}
        voted={selectedCandidate && selectedCandidate.id === votedCandidateId}
        disabled={voteDisabled}
        onVote={handleVote}
        onClose={() => setSelectedCandidateId(null)}
      />
    </div>
  );
}
