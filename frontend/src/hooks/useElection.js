// frontend/src/hooks/useElection.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { useContract } from './useContract'

export function useElection(filter) {
  const { election, ready } = useContract()
  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(false)
  const filterRef = useRef(filter)
  filterRef.current = filter

  const load = useCallback(async function load() {
    if (!ready || !election) { setLoading(false); return }
    const currentFilter = filterRef.current
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
          state: Number(e.state),       // 0=NotStarted 1=Open 2=Ended
          candidateCount: Number(e.candidateCount),
          totalVotes: Number(e.totalVotes),
        }))
        .filter(e => !currentFilter || currentFilter(e))
      setElections(items)
    } catch (err) {
      console.warn('useElection load error:', err)
      setElections([])
    } finally {
      setLoading(false)
    }
  }, [election, ready])

  useEffect(() => { load() }, [load])

  return { elections, loading, reload: load }
}
