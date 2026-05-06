// frontend/src/pages/VotePage.jsx
import React, { useState, useEffect } from 'react'
import { useContract } from '../hooks/useContract'
import { useWallet } from '../hooks/useWallet'
import { useElection } from '../hooks/useElection'
import ElectionSelector from '../components/ElectionSelector'
import CandidateCard from '../components/CandidateCard'

const OPEN = 2

export default function VotePage({ pushToast, setPendingTx }) {
  const { election, voterRegistry, ready } = useContract()
  const { address, isConnected } = useWallet()
  const { elections, loading: loadingElections } = useElection(e => e.state === OPEN)

  const [selectedElection, setSelectedElection] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [isAuthorized, setIsAuthorized] = useState(null) // null=loading
  const [votedCandidateId, setVotedCandidateId] = useState(null)
  const [loadingVote, setLoadingVote] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!selectedElection || !ready) return
    loadElectionData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElection, ready, address])

  async function loadElectionData() {
    setLoadingCandidates(true)
    setIsAuthorized(null)
    setVotedCandidateId(null)
    setCandidates([])
    setLoadError(null)
    try {
      const [results, authorized, voteEvents] = await Promise.all([
        election.getResults(selectedElection.id),
        address
          ? voterRegistry.isAuthorized(selectedElection.id, address)
          : Promise.resolve(false),
        address
          ? election.queryFilter(election.filters.VoteCast(selectedElection.id, null, address))
          : Promise.resolve([]),
      ])
      setCandidates(results.map(c => ({
        id: Number(c.id),
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        voteCount: Number(c.voteCount),
      })))
      setIsAuthorized(Boolean(authorized))
      if (voteEvents.length > 0) {
        setVotedCandidateId(Number(voteEvents[0].args.candidateId))
      }
    } catch (err) {
      console.warn('VotePage loadElectionData:', err)
      setLoadError('Không thể tải dữ liệu. Vui lòng thử lại.')
      setIsAuthorized(false)
    } finally {
      setLoadingCandidates(false)
    }
  }

  async function handleVote(candidateId) {
    if (!selectedElection) return
    setLoadingVote(true)
    try {
      const tx = await election.vote(selectedElection.id, candidateId)
      setPendingTx({ label: 'Bỏ phiếu', hash: tx.hash })
      await tx.wait()
      setVotedCandidateId(candidateId)
      pushToast('Bỏ phiếu thành công!', 'success')
    } catch (err) {
      pushToast(err.reason ?? err.message, 'error')
    } finally {
      setLoadingVote(false)
      setPendingTx(null)
    }
  }

  if (!isConnected) {
    return (
      <div className="container">
        <p style={{ color: '#aaa', marginTop: 32 }}>Kết nối ví để tham gia bỏ phiếu.</p>
      </div>
    )
  }

  return (
    <div className="container admin-page">
      <h2 style={{ marginBottom: 16 }}>Bỏ phiếu</h2>

      <div style={{ marginBottom: 16 }}>
        <ElectionSelector
          elections={elections}
          selected={selectedElection}
          onSelect={setSelectedElection}
          loading={loadingElections}
        />
      </div>

      {selectedElection && (
        <>
          {loadError ? (
            <p style={{ color: '#f55' }}>{loadError}</p>
          ) : isAuthorized === null || loadingCandidates ? (
            <p style={{ color: '#aaa' }}>Đang tải…</p>
          ) : !isAuthorized ? (
            <p style={{ color: '#aaa' }}>
              Bạn không được ủy quyền tham gia cuộc bầu cử này.
            </p>
          ) : candidates.length === 0 ? (
            <p style={{ color: '#aaa' }}>Chưa có ứng viên nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map(c => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  voted={c.id === votedCandidateId}
                  disabled={votedCandidateId !== null || loadingVote}
                  onVote={() => handleVote(c.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
