// frontend/src/hooks/useElection.js
import { useState, useEffect } from 'react'
import { useContract } from './useContract'

export function useElection(filter) {
  const { election, ready } = useContract()
  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!ready || !election) return
    setLoading(true)
    try {
      const count = Number(await election.electionCount())
      const raw = await Promise.all(
        Array.from({ length: count }, (_, i) => election.getElection(i))
      )
      const items = raw
        .filter(e => !e.deleted)
        .map(e => ({
          id: Number(e.id),
          name: e.name,
          description: e.description,
          state: Number(e.state),       // 0=NotStarted 1=Ended 2=Open
          candidateCount: Number(e.candidateCount),
          totalVotes: Number(e.totalVotes),
        }))
        .filter(e => !filter || filter(e))
      setElections(items)
    } catch (err) {
      console.warn('useElection load error:', err)
      setElections([])
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [ready])

  return { elections, loading, reload: load }
}
