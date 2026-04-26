# Dev B Phase 2 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `TODO(Dev B)` in the four frontend files with working React code — `ElectionSelector`, `CandidateCard`, `VotePage`, `ResultsPage` — so the app renders and a full vote flow (pick election → vote → see results) works end-to-end on local Anvil.

**Architecture:** Each component is filled in isolation. `ElectionSelector` fetches all elections once per contract instance and accepts a `filter` prop — used by `VotePage` (Open only) and `ResultsPage` (all). `VotePage` detects "has voted" via past `VoteCast` event queries (no extra contract view needed). `ResultsPage` subscribes to `VoteCast` events for live updates when an election is Open.

**Tech Stack:** React 18, Vite 5, Ethers.js v6, React Router 6. No unit-test runner — validation is visual via `npm run dev` in the browser.

**Prerequisites — must be done before starting this plan:**
1. Phase 1 complete (`forge test -vv` green, both contracts deployed to local Anvil).
2. Dev A has implemented `wallet.js`, `useWallet.js`, and `useContract.js`.
3. ABIs synced: `bash scripts/sync-abi.sh --chain 31337` (creates `frontend/src/contracts/VoterRegistry.json` and `Election.json`).
4. `frontend/.env` exists with `VITE_DEFAULT_CHAIN_ID=31337`.
5. MetaMask installed in your browser, pointed at `http://127.0.0.1:8545` (chainId 31337).

---

## File structure

```
frontend/src/
  components/
    ElectionSelector.jsx   ← Task 1: fetch elections, filter, render <select>
    CandidateCard.jsx      ← Task 2: image fallback, formatted vote count, vote button
  pages/
    VotePage.jsx           ← Task 3: picker → candidate grid → vote action + has-voted check
    ResultsPage.jsx        ← Task 4: results by state, live updates via VoteCast events
  index.css                ← Task 3: add .candidate-grid layout rule
```

---

## Task 1: `ElectionSelector`

**Files:**
- Modify: `frontend/src/components/ElectionSelector.jsx`

- [ ] **Step 1: Implement ElectionSelector**

Replace the entire contents of `frontend/src/components/ElectionSelector.jsx`:

```jsx
// Dropdown of elections scoped by a `filter` predicate.
// Props:
//   value: number | null
//   onChange: (id: number) => void
//   filter?: (e: { id, name, state }) => boolean   (defaults to "all")
//
// state values match Election.State enum: 0=NotStarted, 1=Open, 2=Ended
import { useEffect, useState } from 'react';
import { useContract } from '../hooks/useContract.js';

const STATE_LABELS = ['Not Started', 'Open', 'Ended'];

export default function ElectionSelector({ value, onChange, filter }) {
  const { election } = useContract();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!election) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const count = Number(await election.electionCount());
        const list = [];
        for (let i = 0; i < count; i++) {
          // getElection returns: (id, name, description, creator, state, candidateCount, totalVotes)
          const [id, name, , , state] = await election.getElection(i);
          list.push({ id: Number(id), name, state: Number(state) });
        }
        if (!cancelled) setElections(list);
      } catch (err) {
        console.error('ElectionSelector: failed to load elections', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [election]);

  const displayed = filter ? elections.filter(filter) : elections;

  if (loading) {
    return <select disabled><option>Loading elections…</option></select>;
  }

  if (displayed.length === 0) {
    return <select disabled><option>No elections available</option></select>;
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(Number(e.target.value))}
    >
      <option value="" disabled>Select an election…</option>
      {displayed.map(e => (
        <option key={e.id} value={e.id}>
          {e.name} ({STATE_LABELS[e.state]})
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Verify it renders**

Start the dev server (keep it running for all remaining tasks):
```bash
cd frontend && npm run dev
```
Open `http://localhost:5173/vote`. With Anvil running and at least one election created, the dropdown should show elections. Without a connected wallet, the page shows "Connect a wallet" — that is expected, `useContract` depends on `useWallet`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ElectionSelector.jsx
git commit -m "feat(frontend): implement ElectionSelector (Dev B)"
```

---

## Task 2: `CandidateCard`

**Files:**
- Modify: `frontend/src/components/CandidateCard.jsx`

- [ ] **Step 1: Implement CandidateCard**

Replace the entire contents of `frontend/src/components/CandidateCard.jsx`:

```jsx
// Displays one candidate: image (with fallback), name, description, vote count, vote button.
// Props:
//   candidate: { id, name, description, imageUrl, voteCount }
//   onVote?: (candidateId: number) => Promise<void>
//   disabled?: boolean
import { useState } from 'react';

export default function CandidateCard({ candidate, onVote, disabled }) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="candidate-card">
      {candidate?.imageUrl && !imgError ? (
        <img
          src={candidate.imageUrl}
          alt={candidate?.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', aspectRatio: '3/2', objectFit: 'cover' }}
        />
      ) : (
        <div className="candidate-card__image-placeholder">No image</div>
      )}
      <h3>{candidate?.name}</h3>
      <p>{candidate?.description}</p>
      <p>Votes: {String(candidate?.voteCount ?? 0)}</p>
      <button
        type="button"
        onClick={() => onVote?.(candidate?.id)}
        disabled={disabled}
        className="btn btn--primary"
      >
        Vote
      </button>
    </article>
  );
}
```

- [ ] **Step 2: Verify it renders**

Navigate to `http://localhost:5173/vote`. Once connected and an Open election with candidates is selected, each candidate should show as a card. Images with broken URLs fall back to the "No image" placeholder.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CandidateCard.jsx
git commit -m "feat(frontend): implement CandidateCard (Dev B)"
```

---

## Task 3: `VotePage`

**Files:**
- Modify: `frontend/src/pages/VotePage.jsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add `.candidate-grid` CSS rule**

Open `frontend/src/index.css`. Append at the end:

```css
.candidate-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
```

- [ ] **Step 2: Implement VotePage**

Replace the entire contents of `frontend/src/pages/VotePage.jsx`:

```jsx
// Voter flow: pick an Open election → candidate grid → cast vote.
// Has-voted is derived from past VoteCast events (no extra contract view needed).
import { useCallback, useEffect, useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import { useWallet } from '../hooks/useWallet.js';
import ElectionSelector from '../components/ElectionSelector.jsx';
import CandidateCard from '../components/CandidateCard.jsx';

const STATE_OPEN = 1; // Election.State.Open

export default function VotePage() {
  const { election, voterRegistry, ready } = useContract();
  const { address } = useWallet();
  const [electionId, setElectionId]     = useState(null);
  const [candidates, setCandidates]     = useState([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasVoted, setHasVoted]         = useState(false);
  const [pending, setPending]           = useState(false);
  const [error, setError]               = useState(null);

  // Load candidates + voter status whenever the selected election or wallet changes.
  useEffect(() => {
    if (!election || !voterRegistry || electionId === null || !address) return;
    let cancelled = false;

    async function load() {
      try {
        // Candidates
        const count = Number(await election.getCandidateCount(electionId));
        const list = [];
        for (let i = 0; i < count; i++) {
          const c = await election.getCandidate(electionId, i);
          list.push({
            id:          Number(c.id),
            name:        c.name,
            description: c.description,
            imageUrl:    c.imageUrl,
            voteCount:   c.voteCount,
          });
        }

        // Authorization check
        const auth = await voterRegistry.isAuthorized(electionId, address);

        // Has-voted: query past VoteCast(electionId, *, address) events
        const filter = election.filters.VoteCast(electionId, null, address);
        const events = await election.queryFilter(filter, 0, 'latest');
        const voted  = events.length > 0;

        if (!cancelled) {
          setCandidates(list);
          setIsAuthorized(auth);
          setHasVoted(voted);
        }
      } catch (err) {
        console.error('VotePage: failed to load election data', err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [election, voterRegistry, electionId, address]);

  const handleVote = useCallback(async (candidateId) => {
    if (!election || electionId === null) return;
    setError(null);
    setPending(true);
    try {
      const tx = await election.vote(electionId, candidateId);
      await tx.wait();
      setHasVoted(true);
      // Refresh vote counts
      const count = Number(await election.getCandidateCount(electionId));
      const list = [];
      for (let i = 0; i < count; i++) {
        const c = await election.getCandidate(electionId, i);
        list.push({
          id:          Number(c.id),
          name:        c.name,
          description: c.description,
          imageUrl:    c.imageUrl,
          voteCount:   c.voteCount,
        });
      }
      setCandidates(list);
    } catch (err) {
      setError(err.reason ?? err.message ?? 'Transaction failed');
    } finally {
      setPending(false);
    }
  }, [election, electionId]);

  if (!ready) return <p>Connect a wallet to continue.</p>;

  return (
    <div className="vote-page">
      <h2>Cast your vote</h2>

      <ElectionSelector
        value={electionId}
        onChange={id => { setElectionId(id); setCandidates([]); setError(null); }}
        filter={e => e.state === STATE_OPEN}
      />

      {electionId === null && (
        <p>Select an open election above.</p>
      )}

      {electionId !== null && !isAuthorized && (
        <p>Your wallet is not authorized to vote in this election.</p>
      )}

      {electionId !== null && isAuthorized && hasVoted && (
        <p>You have already voted in this election.</p>
      )}

      {error && (
        <p style={{ color: '#c00' }}>{error}</p>
      )}

      {electionId !== null && candidates.length > 0 && (
        <div className="candidate-grid">
          {candidates.map(c => (
            <CandidateCard
              key={c.id}
              candidate={c}
              onVote={handleVote}
              disabled={!isAuthorized || hasVoted || pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the vote flow**

With Anvil running, contracts deployed, and the demo account connected in MetaMask:
1. Navigate to `/vote`.
2. Pick an Open election — candidates appear as cards.
3. If the wallet is authorized, click Vote on a candidate — MetaMask prompts, transaction confirms, vote count increments.
4. After voting, all Vote buttons become disabled and "You have already voted" appears.
5. Unauthorized wallet: all Vote buttons are disabled and the authorization message appears.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/VotePage.jsx frontend/src/index.css
git commit -m "feat(frontend): implement VotePage with vote flow (Dev B)"
```

---

## Task 4: `ResultsPage`

**Files:**
- Modify: `frontend/src/pages/ResultsPage.jsx`

- [ ] **Step 1: Implement ResultsPage**

Replace the entire contents of `frontend/src/pages/ResultsPage.jsx`:

```jsx
// Live results and winner view for a selected election.
// Subscribes to VoteCast events when election is Open for live updates.
import { useEffect, useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import ElectionSelector from '../components/ElectionSelector.jsx';
import CandidateCard from '../components/CandidateCard.jsx';

const STATE_NOT_STARTED = 0;
const STATE_OPEN        = 1;
const STATE_ENDED       = 2;

export default function ResultsPage() {
  const { election, ready }            = useContract();
  const [electionId, setElectionId]    = useState(null);
  const [electionState, setElectionState] = useState(null);
  const [candidates, setCandidates]    = useState([]);
  const [winner, setWinner]            = useState(null);

  useEffect(() => {
    if (!election || electionId === null) return;
    let cancelled = false;

    async function loadResults() {
      try {
        const [, , , , state] = await election.getElection(electionId);
        const stateNum = Number(state);

        if (stateNum === STATE_NOT_STARTED) {
          if (!cancelled) { setElectionState(stateNum); setCandidates([]); setWinner(null); }
          return;
        }

        const raw = await election.getResults(electionId);
        const list = raw.map(c => ({
          id:          Number(c.id),
          name:        c.name,
          description: c.description,
          imageUrl:    c.imageUrl,
          voteCount:   c.voteCount,
        }));

        let w = null;
        if (stateNum === STATE_ENDED) {
          try {
            const wRaw = await election.getWinner(electionId);
            w = { id: Number(wRaw.id), name: wRaw.name };
          } catch {
            // NoVotesCast — winner stays null
          }
        }

        if (!cancelled) {
          setElectionState(stateNum);
          setCandidates(list);
          setWinner(w);
        }
      } catch (err) {
        console.error('ResultsPage: failed to load results', err);
      }
    }

    loadResults();

    // Live refresh on VoteCast while election is Open
    const onVoteCast = () => loadResults();
    const eventFilter = election.filters.VoteCast(electionId);
    election.on(eventFilter, onVoteCast);

    return () => {
      cancelled = true;
      election.off(eventFilter, onVoteCast);
    };
  }, [election, electionId]);

  const handleElectionChange = id => {
    setElectionId(id);
    setElectionState(null);
    setCandidates([]);
    setWinner(null);
  };

  if (!ready) return <p>Connect a wallet to view results.</p>;

  return (
    <div className="results-page">
      <h2>Results</h2>

      <ElectionSelector value={electionId} onChange={handleElectionChange} />

      {electionId !== null && electionState === STATE_NOT_STARTED && (
        <p>This election has not started yet.</p>
      )}

      {electionId !== null && electionState === STATE_OPEN && (
        <>
          <p>Election is open — results update live.</p>
          <div className="candidate-grid">
            {candidates.map(c => (
              <CandidateCard key={c.id} candidate={c} disabled />
            ))}
          </div>
        </>
      )}

      {electionId !== null && electionState === STATE_ENDED && (
        <>
          {winner ? (
            <p><strong>Winner: {winner.name}</strong></p>
          ) : (
            <p>No votes were cast in this election.</p>
          )}
          <div className="candidate-grid">
            {candidates.map(c => (
              <CandidateCard key={c.id} candidate={c} disabled />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the results flow**

End-to-end check on `/results`:
1. Pick a **NotStarted** election — "This election has not started yet."
2. Pick an **Open** election with votes — candidate cards show current vote counts; cast a vote from `/vote` in another tab and confirm the counts update live (no page refresh).
3. Pick an **Ended** election — winner highlighted at top, all candidates listed below with final counts. An ended election with zero votes shows "No votes were cast."

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ResultsPage.jsx
git commit -m "feat(frontend): implement ResultsPage with live updates (Dev B)"
```

---

## Task 5: End-to-end demo verification

No new files.

- [ ] **Step 1: Run the full dev loop**

```bash
bash scripts/dev.sh
```
Expected: Anvil starts, contracts deploy, ABIs sync, Vite starts at `http://localhost:5173`.

- [ ] **Step 2: Full demo script**

Walk through all six steps:
1. Connect MetaMask on `/admin` — deployer account (Anvil account 0) is admin.
2. Create election "Student Council 2026" with a description.
3. Add 3 candidates with names, descriptions, and image URLs.
4. Authorize 2 voter addresses (Anvil accounts 1 and 2).
5. Start the election. Switch MetaMask to a voter account; vote on `/vote`.
6. Switch back to admin; end the election on `/admin`; view winner on `/results`.

- [ ] **Step 3: Commit**

```bash
git tag -a v0.2.0-phase2 -m "Phase 2 complete — Dev B frontend implemented"
```
