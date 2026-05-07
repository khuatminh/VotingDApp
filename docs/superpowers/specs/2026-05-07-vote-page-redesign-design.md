# Vote Page Redesign — Design Spec

**Date:** 2026-05-07
**Status:** Approved (awaiting plan)

## Goal

Replace the single-page VotePage (dropdown + vertical candidate list) with a richer two-route flow that surfaces more election context, exposes per-candidate biographical detail, and lets voters scan candidates in a responsive grid before committing a vote.

## Decisions

- **Smart contract change**: add `slogan` (short tagline) and `bio` (long-form) string fields to the `Candidate` struct in `contracts/src/Election.sol`. The existing `description` field is kept (medium-length summary). This is a breaking ABI change requiring redeploy and `frontend/src/contracts/addresses.json` update.
- **Routing**: split `/vote` into a list page and a detail page.
- **Election list filter**: show all states (`Open` / `NotStarted` / `Ended`) with filter chips at the top. Default chips active: `Open` and `NotStarted`.
- **Candidate interaction**: grid card shows a Vote button directly. Clicking the card body (not the button) opens a modal with the full bio.
- **Live vote distribution** is shown on the detail page above the candidate grid. This intentionally overlaps with `/results` — here it is an at-a-glance signal during voting, not the full ranking page.

## Smart contract

### `contracts/src/Election.sol` — Candidate struct

```solidity
struct Candidate {
    uint256 id;
    string  name;
    string  slogan;       // NEW: 1-line tagline shown on grid cards
    string  description;  // existing: medium summary, optional
    string  bio;          // NEW: long-form biography, shown in modal
    string  imageUrl;
    uint256 voteCount;
}
```

### `addCandidate` signature

The contract function that adds a candidate now accepts `slogan` and `bio` parameters in addition to the existing arguments. The frontend admin form and any tests/scripts that call it must pass the new arguments (empty strings allowed).

### `getResults` / candidate views

Any view function that returns `Candidate` (e.g. `getResults`) returns the expanded struct automatically once the struct is updated.

### Migration

This is a breaking ABI change. After redeploy:
- Update `frontend/src/contracts/addresses.json` with the new contract address.
- Regenerate / update the ABI consumed by `useContract`.
- Existing on-chain data on the old contract is not migrated; new contract starts empty.

## Routing

```
/                  → redirect to /vote
/vote              → ElectionListPage
/vote/:id          → ElectionDetailPage
/results           → ResultsPage (unchanged)
/admin             → AdminPage (form gets slogan + bio inputs)
```

`react-router-dom` route table in `frontend/src/App.jsx` is updated accordingly. Invalid `:id` (NaN, non-existent, or `deleted`) on the detail page renders a "Election not found" empty state with a back link.

## Pages and components

### `ElectionListPage` (`frontend/src/pages/ElectionListPage.jsx`, new)

Replaces the election-selection portion of the current VotePage.

- Uses existing `useElection()` hook with no filter (loads all non-deleted elections).
- Top of page: filter chip row — `Open`, `NotStarted`, `Ended`. Each chip toggles independently. Local component state holds the active set; default `{Open, NotStarted}`.
- Grid of `ElectionListCard` components, filtered by the chip state.
- Empty state: "Không có cuộc bầu cử nào phù hợp." when no elections match the active chips.

### `ElectionListCard` (`frontend/src/components/ElectionListCard.jsx`, new)

```
┌──────────────────────────────────────────┐
│  Election Name                  [Open]   │
│  Description preview text…               │
│  ─────────────────────────────────       │
│  📊 42 votes  ·  👥 5 candidates         │
└──────────────────────────────────────────┘
```

- Whole card is clickable; uses `useNavigate()` to push `/vote/${id}`.
- State badge color: green Open, gray NotStarted, amber Ended.
- For Ended elections, an additional "View results" link below counts navigates to `/results` (with the relevant election preselected if ResultsPage supports it; otherwise just `/results`).

### `ElectionDetailPage` (`frontend/src/pages/ElectionDetailPage.jsx`, new)

Replaces the post-selection portion of the current VotePage.

Reads `:id` from the URL, fetches via the new `useElectionDetail` hook (see below). Renders:

1. Back link to `/vote`.
2. `ElectionDetailHeader` (election context).
3. `CandidateGrid` (the candidate cards).
4. `CandidateDetailModal` (rendered conditionally based on `selectedCandidateId` state).

States handled:
- Wallet not connected → "Kết nối ví để tham gia bỏ phiếu."
- Loading → spinner / "Đang tải…"
- Election not found / deleted → "Election not found" empty state with back link.
- Not authorized → header still shown (so voter sees context); grid shows "Bạn không được ủy quyền tham gia cuộc bầu cử này." in place of cards.
- Election ended → grid renders cards in read-only mode (Vote buttons disabled), banner "Cuộc bầu cử đã kết thúc — xem kết quả" links to `/results`.
- Already voted → voted candidate's card shows ✓ chip and a green ring; other cards' Vote buttons disabled.
- Load error → inline error message with retry.

### `ElectionDetailHeader` (`frontend/src/components/ElectionDetailHeader.jsx`, new)

```
Election Name                              [Open]
Full description text wraps here…

┌──────────┬──────────┬──────────┬──────────┐
│ Total    │ Candi-   │ Your     │ Auth     │
│ votes    │ dates    │ status   │ status   │
│   42     │    5     │  ✓ Voted │  ✓ OK    │
└──────────┴──────────┴──────────┴──────────┘

▌Your vote: [avatar] Alice Nguyen   ← only if voted

Live distribution
Alice  ████████████░░░░░░░  40%
Bob    ██████░░░░░░░░░░░░░  20%
Carol  ████████████░░░░░░░  40%
```

Behavior:
- 4 stat tiles in a responsive row (collapses to 2x2 on narrow viewports).
- "Auth status" tile values: `✓ OK` / `✗ Not authorized` / `—` (wallet not connected).
- "Your vote" row appears only when the user has voted; clicking the avatar opens the corresponding candidate's modal.
- Live distribution: horizontal bar per candidate, sorted by `voteCount` descending. When `totalVotes === 0`, render "No votes yet" instead of bars.

### `CandidateGrid` (`frontend/src/components/CandidateGrid.jsx`, new)

CSS grid with `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` and 16px gap. Renders one `CandidateGridCard` per candidate. Holds no state; receives `candidates`, `votedCandidateId`, `disabled`, `onVote`, `onSelect` as props.

### `CandidateGridCard` (`frontend/src/components/CandidateGridCard.jsx`, new — replaces `CandidateCard.jsx`)

```
┌─────────────────────┐
│      ⬤ avatar       │   80px circle
│   Alice Nguyen      │
│  "Together we rise" │
│   [  Bỏ phiếu  ]    │
└─────────────────────┘
```

- Avatar: image if `imageUrl` present and loads; otherwise color fallback (existing `AVATAR_COLORS` palette).
- Slogan rendered italic/muted, single line, truncated with ellipsis.
- Vote button calls `onVote(id)` with `e.stopPropagation()` so the card-body click handler does not also fire.
- Card-body click (anywhere except the button) calls `onSelect(id)` to open the modal.
- Voted state: button replaced with `Đã bỏ phiếu ✓` chip; card has green outline.
- Disabled state: button disabled when (a) user already voted for someone else, (b) election ended, or (c) a vote tx is in flight.

### `CandidateDetailModal` (`frontend/src/components/CandidateDetailModal.jsx`, new)

Receives `candidate`, `voted`, `disabled`, `onVote`, `onClose`. Rendered at page level inside `ElectionDetailPage`, opened via `selectedCandidateId` state.

```
┌────────────────────────────────────────┐
│                                  [×]   │
│ ┌──────┐                                │
│ │ img  │  Alice Nguyen                  │
│ │ 96px │  "Together we rise"            │
│ └──────┘  ✓ 12 votes so far             │
│                                          │
│ Tiểu sử                                  │
│ Long bio paragraph wraps here. Multi-    │
│ line, scrollable if it overflows the    │
│ modal height.                            │
│                                          │
│ Mô tả                                    │
│ Existing description shown if non-empty. │
│                                          │
│ ───────────────────────────────────      │
│              [  Bỏ phiếu  ]              │
└────────────────────────────────────────┘
```

- Closes on: `×` button, Escape key, backdrop click.
- Vote button inside modal calls the same `onVote` and closes the modal on success.
- "Mô tả" section is hidden when `candidate.description` is empty.
- Bio uses `white-space: pre-wrap` so paragraph breaks survive.
- Modal uses an existing or new lightweight portal pattern; trap focus inside while open (standard accessibility practice).

### `AdminPage` (`frontend/src/pages/AdminPage.jsx`, modified)

The candidate-creation form gains two new inputs:
- `slogan`: single-line text input, soft hint "max ~60 chars".
- `bio`: textarea, ~6 rows, accepts multi-line input.

The `addCandidate` call passes `(electionId, name, slogan, description, bio, imageUrl)` matching the new contract signature. Empty strings are allowed for slogan/description/bio/imageUrl; only name is required.

### `ResultsPage` (`frontend/src/pages/ResultsPage.jsx`, compatibility-only)

ResultsPage already calls `getResults` and consumes the candidate shape. After the contract change it must keep working with the expanded struct. No new fields are required to render — the existing ranking display works as-is. The only required change is the destructuring/mapping logic if it positionally extracts struct fields; if it accesses by name, no change.

### Components removed / repurposed

- `frontend/src/components/ElectionSelector.jsx` — removed (replaced by `ElectionListPage`).
- `frontend/src/components/CandidateCard.jsx` — removed (replaced by `CandidateGridCard.jsx`).
- `frontend/src/pages/VotePage.jsx` — removed (split into `ElectionListPage` + `ElectionDetailPage`).

## Hooks

### `useElection(filter)` — unchanged

Continues to load all non-deleted elections and apply an optional predicate. `ElectionListPage` calls it with no filter and applies the chip predicate in component-level state.

### `useElectionDetail(id)` — new (`frontend/src/hooks/useElectionDetail.js`)

```js
const { election, candidates, isAuthorized, votedCandidateId, loading, error, reload } = useElectionDetail(id)
```

Responsibilities:
- Fetch the single election by id (via `election.getElection(id)`), reject if `deleted`.
- Fetch candidates via `election.getResults(id)` mapped to the expanded shape including `slogan` and `bio`.
- Fetch authorization (`voterRegistry.isAuthorized(id, address)`) when wallet connected.
- Fetch the user's prior `VoteCast` event for this election, derive `votedCandidateId`.
- Poll every ~5 seconds while the election state is `Open` to refresh `totalVotes` and per-candidate `voteCount` (for the live distribution bar). Polling stops when state becomes `Ended` or the component unmounts. Pattern mirrors what `ResultsPage` already uses; if reusable polling logic exists there, factor it out into a small shared utility rather than duplicating.
- Return `error` for the page to surface inline.

## Styling

Reuse existing CSS classes where possible: `.container`, `.row-card`, `.btn`, `.btn-accent`, `.input`. New CSS additions go in the existing global stylesheet (or a colocated module if that is the project pattern):

- `.candidate-grid` — the grid container.
- `.candidate-card` — the new grid card (distinct from `.row-card` which is horizontal).
- `.election-card` — the list page card.
- `.modal-backdrop`, `.modal` — for `CandidateDetailModal`.
- `.stat-tile`, `.distribution-bar` — for the detail header.
- `.filter-chip`, `.filter-chip.active` — for the list page chips.

## Data flow summary

```
ElectionListPage
  uses useElection() (all elections)
  local state: activeChips
  renders: filter chips, ElectionListCard[]
  click card → router.push(/vote/:id)

ElectionDetailPage
  reads :id from URL
  uses useElectionDetail(id)
  local state: selectedCandidateId, isVoting
  renders: ElectionDetailHeader, CandidateGrid, CandidateDetailModal
  vote flow: handleVote(candidateId) → contract.vote() → tx.wait() → reload()
```

## Out of scope

- Visual theme / restyle outside the new components.
- Markdown rendering in bio (plain text with preserved line breaks only).
- Search / sort within the candidate grid.
- Pagination on the election list (assumed small N for the project scale).
- Internationalization beyond the existing Vietnamese strings.
- Migrating data from the old contract to the new one.

## Risks and trade-offs

- **Breaking ABI change**: every environment (local hardhat, any deployed network) must redeploy the contract. Frontend addresses.json must be updated in lockstep. Tests calling `addCandidate` need updates.
- **Live distribution overlap with /results**: intentional. Header bars are a glance; ResultsPage stays the canonical ranking view.
- **Modal vote vs grid vote button**: Both paths must remain consistent; the same `handleVote` is called from both. The grid button is the primary path; the modal exists for the curious voter.
- **Polling cost**: detail page polls at ~5s intervals while Open. Same pattern as ResultsPage; acceptable for the project scale.

## Testing

- **Contract**: existing Election.sol Foundry / Hardhat tests are updated to pass `slogan` and `bio` arguments to `addCandidate`. Add at least one test that round-trips non-empty slogan/bio through `getResults` to confirm storage and retrieval.
- **Frontend**: smoke-level coverage — route navigation `/vote → /vote/:id` works, filter chips toggle list contents, modal opens/closes via button/Escape/backdrop, vote button on grid casts a tx, voted state persists across reload. End-to-end against a local hardhat node is the primary verification path; unit tests for component rendering are nice-to-have but not required for sign-off.

## Success criteria

- Voter can browse all elections (Open / NotStarted / Ended) on `/vote`, filter via chips, and click into one.
- On `/vote/:id`, voter sees election context (description, status, counts, distribution) and a responsive grid of candidates with avatar + name + slogan.
- Clicking a candidate's card opens a modal with the full bio; clicking the candidate's Vote button casts the vote.
- Voted state is reflected immediately (chip on card, "Your vote:" row in header) and persists on reload.
- Admin can add candidates with slogan and bio fields populated.
- Existing `/results` page continues to work unchanged.
