# Dev B Phase 2 — VotePage & ResultsPage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the voter-facing pages (VotePage, ResultsPage) and shared components (ElectionSelector, CandidateCard, useElection) so a connected, authorized voter can select an election, cast a vote, and view results.

**Architecture:** A shared `useElection` hook loads and filters elections from the contract; both VotePage and ResultsPage consume it via `ElectionSelector`. VotePage handles the vote flow with authorization checks and optimistic UI. ResultsPage polls the contract every 5 seconds for live results when an election is Open, and shows a ranked winner display when Ended.

**Tech Stack:** React 18, ethers v6, Vite 5, existing design system in `index.css` (CSS classes: `.btn`, `.btn-accent`, `.row-card`, `.badge`, `.input`, `.container`, `.admin-page`)

**Spec:** `docs/superpowers/specs/2026-05-04-devb-phase2-design.md`

**Election state enum (non-obvious):** `enum State { NotStarted, Ended, Open }` → `0=NotStarted, 1=Ended, 2=Open`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/hooks/useElection.js` | **Create** | Load + filter elections from contract |
| `frontend/src/components/ElectionSelector.jsx` | **Replace** skeleton | Dropdown UI for election selection |
| `frontend/src/components/CandidateCard.jsx` | **Replace** skeleton | Single candidate list-row with vote button |
| `frontend/src/pages/VotePage.jsx` | **Replace** skeleton | Full voting flow for authorized voters |
| `frontend/src/pages/ResultsPage.jsx` | **Replace** skeleton | State-dependent results with polling |

---

## Task 1: `useElection` hook

**Files:**
- Create: `frontend/src/hooks/useElection.js`

- [ ] **Step 1: Create the hook**

```js
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
```

- [ ] **Step 2: Verify the hook exists and exports correctly**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp/frontend"
node -e "import('./src/hooks/useElection.js').then(m => console.log(typeof m.useElection))"
```
Expected output: `function`

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp"
git add frontend/src/hooks/useElection.js
git commit -m "feat(frontend): add useElection hook with optional filter"
```

---

## Task 2: `ElectionSelector` component

**Files:**
- Modify: `frontend/src/components/ElectionSelector.jsx` (replace skeleton)

- [ ] **Step 1: Replace the skeleton**

```jsx
// frontend/src/components/ElectionSelector.jsx
import React from 'react'

const STATE_LABELS = { 0: 'NotStarted', 1: 'Ended', 2: 'Open' }

export default function ElectionSelector({ elections, selected, onSelect, loading }) {
  if (loading) {
    return (
      <select className="input" disabled>
        <option>Đang tải…</option>
      </select>
    )
  }
  if (!elections || !elections.length) {
    return (
      <select className="input" disabled>
        <option>Không có cuộc bầu cử nào</option>
      </select>
    )
  }
  return (
    <select
      className="input"
      value={selected?.id ?? ''}
      onChange={e => {
        const id = Number(e.target.value)
        onSelect(elections.find(el => el.id === id) ?? null)
      }}
    >
      <option value="">— Chọn cuộc bầu cử —</option>
      {elections.map(el => (
        <option key={el.id} value={el.id}>
          {el.name} [{STATE_LABELS[el.state] ?? el.state}]
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Start dev server and verify no errors**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp/frontend"
npm run dev
```

Open http://localhost:5173. Navigate to `/results` — the page should render without a JS error in the console. The selector will show "Đang tải…" or "Không có cuộc bầu cử nào" (no wallet connected yet).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp"
git add frontend/src/components/ElectionSelector.jsx
git commit -m "feat(frontend): implement ElectionSelector dropdown"
```

---

## Task 3: `CandidateCard` component

**Files:**
- Modify: `frontend/src/components/CandidateCard.jsx` (replace skeleton)

- [ ] **Step 1: Replace the skeleton**

```jsx
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
```

- [ ] **Step 2: Verify in browser**

With dev server running (http://localhost:5173), open browser console — no new errors. The component will be tested visually in Task 4.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp"
git add frontend/src/components/CandidateCard.jsx
git commit -m "feat(frontend): implement CandidateCard list-row component"
```

---

## Task 4: `VotePage`

**Files:**
- Modify: `frontend/src/pages/VotePage.jsx` (replace skeleton)

- [ ] **Step 1: Replace the skeleton**

```jsx
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
    } finally {
      setLoadingCandidates(false)
    }
  }

  async function handleVote(candidateId) {
    setLoadingVote(true)
    try {
      const tx = await election.vote(selectedElection.id, candidateId)
      setPendingTx('Bỏ phiếu', tx.hash)
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
          {isAuthorized === null || loadingCandidates ? (
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
```

- [ ] **Step 2: Manual verification — setup (requires MetaMask on chain 31337)**

In AdminPage (`/admin`):
1. Create an election (e.g. name: "Test", description: "desc")
2. Add ≥ 2 candidates
3. Authorize your wallet address as a voter for this election
4. Start the election

- [ ] **Step 3: Manual verification — vote flow**

Navigate to `/vote`:
- The election selector shows "Test [Open]"
- Select it — candidate list appears as rows
- Click "Bỏ phiếu" on any candidate
- PendingTxRibbon appears with "Bỏ phiếu"
- After confirmation: toast "Bỏ phiếu thành công!", voted candidate shows "Đã bỏ phiếu ✓", all other buttons are disabled
- Refresh the page — the voted candidate is still highlighted (loaded from VoteCast event)

- [ ] **Step 4: Manual verification — unauthorized voter**

Switch MetaMask to a different address (not authorized). Navigate to `/vote`, select the election.
Expected: "Bạn không được ủy quyền tham gia cuộc bầu cử này."

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp"
git add frontend/src/pages/VotePage.jsx
git commit -m "feat(frontend): implement VotePage with authorization and vote flow"
```

---

## Task 5: `ResultsPage`

**Files:**
- Modify: `frontend/src/pages/ResultsPage.jsx` (replace skeleton)

- [ ] **Step 1: Replace the skeleton**

```jsx
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
```

- [ ] **Step 2: Verify — Open election live polling**

Navigate to `/results`, select the Open election from Task 4:
- Ranking list appears with vote counts
- "Đang diễn ra — cập nhật mỗi 5 giây" badge visible
- Open browser console — no errors
- Vote from another authorized address in VotePage — within 5s the count updates on ResultsPage

- [ ] **Step 3: Verify — Ended election with winner**

In AdminPage, end the election:
- Navigate back to `/results`, select the ended election
- Ranking shows 🥇 row with lime border and `#c2ff3d` name text
- Total vote count appears at bottom
- "Đang diễn ra" badge is gone

- [ ] **Step 4: Verify — NotStarted election**

Create a new election in AdminPage (don't start it). Select it in ResultsPage:
- Shows "Cuộc bầu cử chưa bắt đầu."

- [ ] **Step 5: Verify — contract tests still pass**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp/contracts"
forge test
```
Expected: `44 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Admin/Desktop/New folder (2)/VotingDApp"
git add frontend/src/pages/ResultsPage.jsx
git commit -m "feat(frontend): implement ResultsPage with ranking and live polling"
```

---

## Self-Review Checklist

- [x] `useElection` hook — Task 1 ✓
- [x] `ElectionSelector` component — Task 2 ✓
- [x] `CandidateCard` list-row layout — Task 3 ✓
- [x] VotePage: election selector filtered to Open — Task 4 ✓
- [x] VotePage: authorization check via `isAuthorized()` — Task 4 ✓
- [x] VotePage: detect already-voted via `VoteCast` event query — Task 4 ✓
- [x] VotePage: highlight voted candidate, disable buttons — Task 4 ✓
- [x] VotePage: `handleVote` with pending ribbon + toast — Task 4 ✓
- [x] VotePage: wallet not connected guard — Task 4 ✓
- [x] ResultsPage: all elections (no filter) — Task 5 ✓
- [x] ResultsPage: NotStarted message — Task 5 ✓
- [x] ResultsPage: Open → polling every 5s — Task 5 ✓
- [x] ResultsPage: Ended → winner highlight + ranking — Task 5 ✓
- [x] ResultsPage: Ended + no votes → "Không có phiếu" — Task 5 ✓
- [x] ResultsPage: cleanup interval on unmount — Task 5 ✓
- [x] State enum constants (NOT_STARTED=0, ENDED=1, OPEN=2) consistent across all tasks ✓
- [x] `candidate.id` accessed as `Number(c.id)` consistently (BigInt from ethers) ✓
