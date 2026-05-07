// frontend/src/pages/ResultsPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useContract } from '../hooks/useContract'
import { useElection } from '../hooks/useElection'
import ElectionSelector from '../components/ElectionSelector'

const MEDALS = ['🥇', '🥈', '🥉']
const NOT_STARTED = 0
const OPEN = 1
const ENDED = 2
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

  const loadResults = useCallback(async function loadResults(el) {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    setLoading(true)
    setResults([])
    setWinner(null)

    if (el.state === NOT_STARTED) { setLoading(false); return }

    async function fetchSorted() {
      const raw = await election.getResults(el.id)
      const sorted = [...raw]
        .map(c => ({ id: Number(c.id), name: c.name, description: c.description, voteCount: Number(c.voteCount), imageUrl: c.imageUrl }))
        .sort((a, b) => b.voteCount - a.voteCount)
      setResults(sorted)
      return sorted
    }

    try {
      if (el.state === OPEN) {
        await fetchSorted()
        pollRef.current = setInterval(async () => {
          // Re-check election state to handle live-to-ended transition
          try {
            const current = await election.getElection(el.id)
            const currentState = Number(current.state)
            if (currentState === ENDED) {
              // Election just ended — stop polling, fetch winner
              clearInterval(pollRef.current)
              pollRef.current = null
              setSelectedElection(prev => ({ ...prev, state: ENDED }))
              const sorted = await fetchSorted()
              try {
                const w = await election.getWinner(el.id)
                setWinner({ id: Number(w.id), name: w.name, voteCount: Number(w.voteCount) })
              } catch { setWinner(null) }
            } else {
              await fetchSorted()
            }
          } catch (err) { console.warn('poll error:', err) }
        }, POLL_MS)
      } else if (el.state === ENDED) {
        await fetchSorted()
        try {
          const w = await election.getWinner(el.id)
          setWinner({ id: Number(w.id), name: w.name, voteCount: Number(w.voteCount) })
        } catch { setWinner(null) }
      }
    } catch (err) {
      console.warn('loadResults error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [election])

  useEffect(() => {
    if (!selectedElection || !ready) return
    loadResults(selectedElection)
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [selectedElection, ready, loadResults])

  if (!ready) return (
    <div className="container admin-page">
      <p style={{ color: '#aaa' }}>Đang kết nối hợp đồng…</p>
    </div>
  )

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
            // Both IDs converted via Number() in fetchSorted / getWinner — contract guarantees consistency
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
