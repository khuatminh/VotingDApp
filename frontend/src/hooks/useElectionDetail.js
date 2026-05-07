import { useState, useEffect, useCallback, useRef } from 'react';
import { useContract } from './useContract';
import { useWallet } from './useWallet';

const NOT_STARTED = 0, OPEN = 1, ENDED = 2;
const POLL_MS = 5000;

export function useElectionDetail(id) {
  const { election, voterRegistry, ready } = useContract();
  const { address } = useWallet();
  const [data, setData] = useState({
    election: null,
    candidates: [],
    isAuthorized: null, // null = unknown / wallet not connected
    votedCandidateId: null,
    loading: true,
    error: null,
  });
  const pollRef = useRef(null);

  const load = useCallback(async function load(opts = { showLoading: true }) {
    if (!ready || !election || id === undefined || id === null) return;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      setData(d => ({ ...d, loading: false, error: 'Invalid election id' }));
      return;
    }

    if (opts.showLoading) setData(d => ({ ...d, loading: true, error: null }));

    try {
      const e = await election.getElection(numericId);
      if (e.deleted) {
        setData(d => ({ ...d, loading: false, error: 'Election not found' }));
        return;
      }
      const electionShape = {
        id: Number(e.id),
        name: e.name,
        description: e.description,
        state: Number(e.state),
        candidateCount: Number(e.candidateCount),
        totalVotes: Number(e.totalVotes),
      };

      const [results, authorized, voteEvents] = await Promise.all([
        election.getResults(numericId),
        address
          ? voterRegistry.isAuthorized(numericId, address)
          : Promise.resolve(null),
        address
          ? election.queryFilter(election.filters.VoteCast(numericId, null, address))
          : Promise.resolve([]),
      ]);

      const candidates = results.map(c => ({
        id: Number(c.id),
        name: c.name,
        slogan: c.slogan,
        description: c.description,
        bio: c.bio,
        imageUrl: c.imageUrl,
        voteCount: Number(c.voteCount),
      }));

      const votedCandidateId = voteEvents.length > 0
        ? Number(voteEvents[0].args.candidateId)
        : null;

      setData({
        election: electionShape,
        candidates,
        isAuthorized: authorized === null ? null : Boolean(authorized),
        votedCandidateId,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.warn('useElectionDetail load:', err);
      setData(d => ({ ...d, loading: false, error: 'Không thể tải dữ liệu.' }));
    }
  }, [ready, election, voterRegistry, address, id]);

  // Initial + on-deps reload
  useEffect(() => { load({ showLoading: true }); }, [load]);

  // Polling while Open
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!data.election || data.election.state !== OPEN) return;
    pollRef.current = setInterval(() => { load({ showLoading: false }); }, POLL_MS);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [data.election?.state, load]);

  return { ...data, reload: () => load({ showLoading: true }) };
}
