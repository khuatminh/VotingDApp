# Dev B — Phase 2: VotePage & ResultsPage

**Date:** 2026-05-04
**Author:** Dev B
**Status:** Approved

---

## Context

Dev A has completed:
- Phase 1: `VoterRegistry.sol` + `Election.sol` with 44 passing tests
- Phase 2: Full frontend infrastructure — wallet layer (`wallet.js`, `useWallet`), contract hook (`useContract`), design system (`index.css`), `Layout`, `ConnectButton`, `Toasts`, `PendingTxRibbon`, and a fully functional `AdminPage` (Elections / Voters / Admins tabs)

Remaining skeletons for Dev B:
- `frontend/src/components/ElectionSelector.jsx` — disabled dropdown stub
- `frontend/src/components/CandidateCard.jsx` — layout stub, no logic
- `frontend/src/pages/VotePage.jsx` — TODO stub
- `frontend/src/pages/ResultsPage.jsx` — TODO stub

This spec covers Dev B Phase 2: implementing the voter-facing pages so that a connected, authorized voter can select an election, cast a vote, and view results.

---

## Contract API (reference)

### Election.sol (key methods for this phase)

| Method | Returns | Notes |
|--------|---------|-------|
| `electionCount()` | `uint256` | Total elections created |
| `getElection(id)` | `(id, name, description, creator, state, candidateCount, totalVotes, deleted)` | State enum: `{ 0: NotStarted, 1: Ended, 2: Open }` |
| `getResults(electionId)` | `Candidate[]` | All candidates with `voteCount` |
| `getWinner(electionId)` | `Candidate` | Reverts if not Ended or no votes cast |
| `vote(electionId, candidateId)` | tx | Reverts: `VoterNotAuthorized`, `AlreadyVoted`, `ElectionNotOpen` |

**Election state enum:** `{ 0: NotStarted, 1: Ended, 2: Open }` — note order from Solidity: `enum State { NotStarted, Ended, Open }`.

**Event:** `VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter)`

### VoterRegistry.sol

| Method | Returns | Notes |
|--------|---------|-------|
| `isAuthorized(electionId, address)` | `bool` | Check before showing vote button |

---

## Architecture

### New file: `frontend/src/hooks/useElection.js`

Shared hook consumed by both VotePage and ResultsPage.

**Signature:**
```js
useElection(filter?: (election) => boolean)
// Returns: { elections, loading, reload }
```

**Behaviour:**
1. Reads `election` contract from `useContract()`
2. On mount (and when `election` is ready): fetch `electionCount()`
3. Loop `i = 0..electionCount-1`: call `getElection(i)`, skip deleted elections (`deleted === true`)
4. Apply `filter` predicate if provided
5. Return `{ elections, loading, reload }` where `reload` re-triggers the fetch

**Error handling:** log warning, return empty array — do not throw.

---

### `frontend/src/components/ElectionSelector.jsx`

Replace the disabled stub.

**Props:** `{ elections, selected, onSelect, loading }`

**Render:**
- Loading state: greyed-out dropdown with "Đang tải…"
- Empty state: "Không có cuộc bầu cử nào"
- Otherwise: `<select>` element styled with existing `.input` class, options formatted as `"{name} [{state badge}]"` where state badge = `NotStarted | Open | Ended`
- Controlled: fires `onSelect(election)` on change

---

### `frontend/src/components/CandidateCard.jsx`

Replace the partial stub. Renders one candidate as a **list row** (layout B).

**Props:** `{ candidate, onVote, voted, disabled }`

- `voted` (bool): this candidate is the one the connected voter already chose
- `disabled` (bool): voter not authorized, or election not open, or loading

**Row layout** (horizontal flex):
1. **Avatar** — `<img src={candidate.imageUrl}>` if URL is non-empty, else a `<div>` circle with a background colour derived from `candidate.id % 5`, cycling through: `#7c5cff`, `#ff5cf2`, `#3d9fef`, `#c2ff3d`, `#ff9f3d`
2. **Info block** — `candidate.name` (bold), `candidate.description` (muted, single line, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`)
3. **Action** — right-aligned:
   - If `voted === true`: lime-coloured `"Đã bỏ phiếu ✓"` text, no button
   - Else: `<button class="btn btn-accent">Bỏ phiếu</button>` — disabled when `disabled`

Reuse existing CSS classes: `.row-card` for the row wrapper, `.btn`, `.btn-accent`, `.badge`.

---

### `frontend/src/pages/VotePage.jsx`

**Route:** `/vote` (already wired in `App.jsx`)

**Props received from App:** `{ pushToast, setPendingTx }`

**State:**
```
selectedElection  — election object | null
candidates        — Candidate[]
isAuthorized      — bool | null (null = loading)
votedCandidateId  — BigInt | null (null = not voted)
loadingVote       — bool
```

**Flow:**

1. **Election list** — `useElection(e => Number(e.state) === 2)` (Open elections only, state=2)
   - Render `<ElectionSelector>` with the filtered list
   - If no open elections: show `"Không có cuộc bầu cử nào đang mở."`

2. **On election select** — when `selectedElection` changes:
   a. `election.getResults(id)` → set `candidates`
   b. `voterRegistry.isAuthorized(id, address)` → set `isAuthorized`
   c. `election.queryFilter(election.filters.VoteCast(id, null, address))` → if result non-empty, set `votedCandidateId` from `event.args.candidateId`

3. **Guard states** (render in this priority):
   - Not connected (`!address`): `"Kết nối ví để tham gia bỏ phiếu."`
   - `isAuthorized === null`: loading spinner
   - `isAuthorized === false`: `"Bạn không được ủy quyền tham gia cuộc bầu cử này."`

4. **Candidate list** — map `candidates` → `<CandidateCard>`:
   - `voted={candidate.id === votedCandidateId}`
   - `disabled={votedCandidateId !== null || loadingVote}`
   - `onVote={() => handleVote(candidate.id)}`

5. **`handleVote(candidateId)`:**
   ```
   setLoadingVote(true)
   tx = await election.vote(selectedElection.id, candidateId)
   setPendingTx("Bỏ phiếu", tx.hash)
   await tx.wait()
   setVotedCandidateId(candidateId)   // optimistic update
   pushToast("Bỏ phiếu thành công!", "success")
   catch e → pushToast(e.reason ?? e.message, "error")
   finally → setLoadingVote(false), setPendingTx(null)
   ```

---

### `frontend/src/pages/ResultsPage.jsx`

**Route:** `/results` (already wired in `App.jsx`)

**State:**
```
selectedElection  — election object | null
results           — Candidate[]
winner            — Candidate | null
loading           — bool
```

**Flow:**

1. **Election list** — `useElection()` (no filter — all non-deleted elections)
   - Render `<ElectionSelector>`

2. **On election select** — call `loadResults(election)`:
   - Clear previous poll interval
   - `Open` state: call `getResults()`, start `setInterval(refreshResults, 5000)`, no winner
   - `Ended` state: call `getResults()` + `getWinner()` (catch `NoVotesCast` → set winner to null), clear interval
   - `NotStarted`: clear results, no fetch needed

3. **Render by state:**

   | State | Render |
   |-------|--------|
   | `NotStarted` | `"Cuộc bầu cử chưa bắt đầu."` |
   | `Open` | Ranking list (no winner highlight) + `"Đang diễn ra — cập nhật mỗi 5 giây"` badge |
   | `Ended`, winner exists | Ranking list, top entry highlighted with 🥇 + lime border |
   | `Ended`, no votes | `"Không có phiếu nào được bỏ."` |

4. **Ranking list** (layout B — chosen by user):
   - Sort `results` descending by `voteCount`
   - Medals: index 0 → 🥇, 1 → 🥈, 2 → 🥉, rest → rank number
   - Each row: medal | name | voteCount phiếu · X% | (winner row gets lime border + background tint)
   - Total votes shown at bottom

5. **Cleanup:** `clearInterval` on component unmount and before each new fetch.

---

## Error & Edge Cases

| Scenario | Handling |
|----------|----------|
| Wallet not connected on VotePage | Show connect prompt, no candidates loaded |
| Voter not authorized | Show message, disable all vote buttons |
| Already voted | Highlight voted candidate, all buttons disabled |
| `getWinner()` reverts (no votes) | Catch error, set `winner = null`, show "Không có phiếu" |
| Contract not ready (`!ready`) | Show loading state in both pages |
| Election deleted mid-session | `useElection` skips deleted, list auto-updates on reload |
| MetaMask rejects vote tx | `pushToast(e.message, "error")` |

---

## Reused Infrastructure

- `useContract()` → `{ election, voterRegistry, isAdmin, ready }` — `hooks/useContract.js`
- `useWallet()` → `{ address, isConnected }` — `hooks/useWallet.js`
- `pushToast`, `setPendingTx` — passed as props from `App.jsx` (same pattern as AdminPage)
- CSS classes: `.btn`, `.btn-accent`, `.btn-ghost`, `.badge`, `.row-card`, `.shell`, `.container`, `.input` — `index.css`
- `shortAddr(addr)` — `lib/utils.js`

---

## Files Modified / Created

| File | Action |
|------|--------|
| `frontend/src/hooks/useElection.js` | **Create** |
| `frontend/src/components/ElectionSelector.jsx` | **Replace** skeleton |
| `frontend/src/components/CandidateCard.jsx` | **Replace** skeleton |
| `frontend/src/pages/VotePage.jsx` | **Replace** skeleton |
| `frontend/src/pages/ResultsPage.jsx` | **Replace** skeleton |

No changes to contracts, routing, App.jsx, or any Dev A files.

---

## Verification

1. Run contract tests: `cd contracts && forge test` — must stay 44/44 green
2. Start dev server: `cd frontend && npm run dev`
3. Connect MetaMask to local network (chain 31337)
4. **Admin flow** (in AdminPage): create election → add ≥2 candidates → start election → authorize your voter address
5. **VotePage** (`/vote`):
   - Open election appears in selector
   - Candidate list renders with vote buttons
   - Click "Bỏ phiếu" → pending ribbon appears → toast success
   - Voted candidate highlights ✓, other buttons disabled
   - Second visit: highlight persists (loaded from VoteCast event)
6. **ResultsPage** (`/results`):
   - Open election: ranking updates every 5s after voting
   - End election in AdminPage → ResultsPage shows 🥇 winner with lime border
   - Election with 0 votes ended → shows "Không có phiếu" message
7. **Wallet not connected**: VotePage shows connect prompt, ResultsPage still loads results
