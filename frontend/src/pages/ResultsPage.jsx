// frontend/src/pages/ResultsPage.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useContract } from '../hooks/useContract'
import { useElection } from '../hooks/useElection'
import ElectionSelector from '../components/ElectionSelector'

const MEDALS = ['🥇', '🥈', '🥉']
const NOT_STARTED = 0
const ENDED = 1
const OPEN = 2
const POLL_MS = 5000

export default function ResultsPage() {
  const { election, ready } = useContract()
  const { elections, loading: loadingElections } = useElection()

  const [selectedElection, setSelectedElection] = useState(null)
  const [results, setResults] = useState([])
  const [winner, setWinner] = useState(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  useEffect(() => {
    if (!selectedElection || !ready) return
    loadResults(selectedElection)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElection, ready])

  async function fetchSorted(electionId) {
    const raw = await election.getResults(electionId)
    return raw
      .map(c => ({
        id: Number(c.id),
        name: c.name,
        voteCount: Number(c.voteCount),
      }))
      .sort((a, b) => b.voteCount - a.voteCount)
  }

  async function loadResults(el) {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setResults([])
    setWinner(null)

    if (el.state === NOT_STARTED) return

    setLoading(true)
    try {
      if (el.state === OPEN) {
        setResults(await fetchSorted(el.id))
        pollRef.current = setInterval(async () => {
          try { setResults(await fetchSorted(el.id)) } catch { /* ignore poll errors */ }
        }, POLL_MS)
      } else if (el.state === ENDED) {
        const sorted = await fetchSorted(el.id)
        setResults(sorted)
        try {
          const w = await election.getWinner(el.id)
          setWinner({ id: Number(w.id), name: w.name })
        } catch {
          setWinner(null) // NoVotesCast
        }
      }
    } catch (err) {
      console.warn('ResultsPage loadResults:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalVotes = results.reduce((sum, c) => sum + c.voteCount, 0)

  function renderContent() {
    if (!selectedElection) return null

    if (selectedElection.state === NOT_STARTED) {
      return <p style={{ color: '#aaa' }}>Cuộc bầu cử chưa bắt đầu.</p>
    }

    if (loading) return <p style={{ color: '#aaa' }}>Đang tải…</p>

    if (selectedElection.state === ENDED && totalVotes === 0) {
      return <p style={{ color: '#aaa' }}>Không có phiếu nào được bỏ.</p>
    }

    return (
      <div>
        {selectedElection.state === OPEN && (
          <div className="badge" style={{ marginBottom: 12 }}>
            Đang diễn ra — cập nhật mỗi 5 giây
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((c, i) => {
            const isWinner = winner && c.id === winner.id
            const pct = totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 100) : 0
            return (
              <div
                key={c.id}
                className="row-card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  ...(isWinner
                    ? { border: '1px solid #c2ff3d', background: '#c2ff3d11' }
                    : {}),
                }}
              >
                <div style={{ width: 28, textAlign: 'center', fontSize: 18, flexShrink: 0 }}>
                  {MEDALS[i] ?? String(i + 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: isWinner ? '#c2ff3d' : '#fff', fontWeight: 'bold' }}>
                    {c.name}
                  </div>
                </div>
                <div style={{ color: '#aaa', fontSize: '0.85rem', flexShrink: 0 }}>
                  {c.voteCount} phiếu · {pct}%
                </div>
              </div>
            )
          })}
        </div>
        {totalVotes > 0 && (
          <div style={{ marginTop: 12, textAlign: 'right', color: '#666', fontSize: '0.8rem' }}>
            Tổng: {totalVotes} phiếu
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container admin-page">
      <h2 style={{ marginBottom: 16 }}>Kết quả bầu cử</h2>
      <div style={{ marginBottom: 16 }}>
        <ElectionSelector
          elections={elections}
          selected={selectedElection}
          onSelect={setSelectedElection}
          loading={loadingElections}
        />
      </div>
      {renderContent()}
    </div>
  )
}
