# Election Thumbnails + Homepage Grid — Design Spec

**Date:** 2026-05-08
**Status:** Approved (awaiting plan)

## Goal

Add a per-election thumbnail image stored on chain and convert the homepage (`/vote`) from a vertical list of election cards to a responsive grid with hero-style thumbnails.

## Decisions

- **Storage:** add a `thumbnailUrl` string field to the on-chain `ElectionData` struct. Same pattern used for the candidate `slogan`/`bio` change. This is a breaking ABI change: requires redeploy and frontend ABI/address sync.
- **Layout on `/vote`:** replace the vertical stack with a CSS grid (`auto-fill, minmax(260px, 1fr)`).
- **Card style:** "Hero thumbnail" — wide thumbnail at the top of each card (16:9 aspect ratio), election name + state badge + counts + optional "View results" link below.
- **Fallback when `thumbnailUrl` is empty or fails to load:** deterministic linear gradient derived from the election id, using the existing accent palette. No emoji, no placeholder text.
- **Admin:** `thumbnailUrl` input added to both the Create and Edit election forms in `AdminPage`.
- **Out of scope:** image upload, cropping, thumbnail on `ElectionDetailPage` header, thumbnail in `ResultsPage`.

## Smart contract

### `contracts/src/Election.sol` — `ElectionData` struct

```solidity
struct ElectionData {
    uint256 id;
    string  name;
    string  description;
    string  thumbnailUrl;   // NEW
    address creator;
    State   state;
    uint256 candidateCount;
    uint256 totalVotes;
    bool    deleted;
    mapping(uint256 => Candidate) candidates;
    mapping(address => bool) hasVoted;
}
```

### `createElection`

New signature:

```solidity
function createElection(
    string calldata name,
    string calldata description,
    string calldata thumbnailUrl
) external onlyRole(ADMIN_ROLE) returns (uint256 electionId)
```

Body assigns `e.thumbnailUrl = thumbnailUrl;` after the existing assignments. The `EmptyName` revert and the `ElectionCreated` event are unchanged.

### `updateElection`

New signature:

```solidity
function updateElection(
    uint256 electionId,
    string calldata name,
    string calldata description,
    string calldata thumbnailUrl
) external onlyRole(ADMIN_ROLE)
```

Body sets `e.thumbnailUrl = thumbnailUrl;` alongside the existing `name` / `description` assignments. The `ElectionUpdated` event is left unchanged (still emits id, name, description) — adding `thumbnailUrl` to the event signature is out of scope for this iteration.

### `getElection`

Add `thumbnailUrl` to the returned tuple. New signature:

```solidity
function getElection(uint256 electionId)
    external
    view
    returns (
        uint256 id,
        string memory name,
        string memory description,
        string memory thumbnailUrl,   // NEW
        address creator,
        State state,
        uint256 candidateCount,
        uint256 totalVotes,
        bool deleted
    )
```

The position is between `description` and `creator` to keep semantic grouping (string content fields together, then audit + lifecycle).

### Tests (`contracts/test/Election.t.sol`)

Every existing call site has to be updated:
- `createElection("name", "desc")` → `createElection("name", "desc", "")` (empty thumbnail).
- `updateElection(...)` calls similarly grow by one empty string.
- Every destructuring of `getElection` adds one more `string memory` between description and creator. Search for `election.getElection(` to enumerate.
- Add at least one new test that round-trips a non-empty `thumbnailUrl` through `getElection`.

### Migration

Same as the slogan/bio change:
- Redeploy via `scripts/dev.sh` or directly via `forge script`.
- Run `bash scripts/sync-abi.sh --chain 31337` to regenerate `Election.json` (gitignored) and update `addresses.json` (committed).
- Old contract data is not migrated.

## Frontend

### `ElectionListPage` (`frontend/src/pages/ElectionListPage.jsx`)

Container changes from `<div className="col gap-16">` to `<div className="election-grid">`. The filter chips above stay unchanged.

### `ElectionListCard` (`frontend/src/components/ElectionListCard.jsx`)

Restructured layout:

```jsx
<article className="election-card">
  <div className="election-card__thumb">
    {thumbnailUrl && !imgError
      ? <img src={thumbnailUrl} onError={…} />
      : <GradientFallback id={id} />}
  </div>
  <div className="election-card__body">
    <header className="row-h">
      <span className="title">{name}</span>
      <StateBadge state={state} />
    </header>
    {description && <p className="election-card__desc">{description}</p>}
    <div className="election-card__meta">
      📊 {totalVotes} vote(s) · 👥 {candidateCount} candidate(s)
    </div>
    {state === ENDED && (
      <Link to="/results">View results →</Link>
    )}
  </div>
</article>
```

Click handling: the entire `<article>` navigates to `/vote/:id`. The existing anchor-click guard is kept so the `View results` `<Link>` opens `/results` instead of the detail page.

The `GradientFallback` is a small in-file helper (no separate component file needed):

```js
const PALETTE = ['#7c5cff', '#ff5cf2', '#3d9fef', '#c2ff3d', '#ff9f3d'];
function gradientFor(id) {
  const a = PALETTE[Number(id) % PALETTE.length];
  const b = PALETTE[(Number(id) + 2) % PALETTE.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
```

Fallback render: `<div style={{ background: gradientFor(id) }} className="election-card__thumb-fallback" />`.

### CSS additions to `frontend/src/index.css`

Append:

```css
/* --- Election grid --- */
.election-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.election-card {
  background: var(--card-solid);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.05s ease;
  display: flex;
  flex-direction: column;
}
.election-card:hover { border-color: var(--ink-3); }
.election-card:active { transform: translateY(1px); }
.election-card__thumb {
  aspect-ratio: 16 / 9;
  width: 100%;
  background: var(--paper);
  overflow: hidden;
}
.election-card__thumb img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.election-card__thumb-fallback {
  width: 100%; height: 100%;
}
.election-card__body { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.election-card__desc {
  color: var(--ink-3);
  font-size: 13px;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.election-card__meta { color: var(--ink-3); font-size: 12px; }
```

The current `.row-card` style on `ElectionListCard` is replaced — the new `.election-card` class is its own thing and shouldn't reuse `.row-card`.

### `useElection` hook

Update the mapping so each returned election object includes `thumbnailUrl`:

```js
return {
  id: Number(e.id),
  name: e.name,
  description: e.description,
  thumbnailUrl: e.thumbnailUrl,    // NEW
  state: Number(e.state),
  candidateCount: Number(e.candidateCount),
  totalVotes: Number(e.totalVotes),
};
```

### `useElectionDetail` hook

Same addition to the `electionShape` mapping. Even though the detail page doesn't currently render the thumbnail, returning it keeps the hook honest with the contract.

### `AdminPage`

Two forms get a new field, two state pairs get added, two handlers get a new arg:

- **Create form** — add `thumbUrl/setThumbUrl` state. New input under "Description". `handleCreate` passes `thumbUrl.trim()` as the third arg to `election.createElection`. Optimistic `setElections` includes `thumbnailUrl: thumbUrl.trim()`.
- **Edit form** — add `editThumbUrl/setEditThumbUrl` state. `openEdit(e)` seeds `setEditThumbUrl(e.thumbnailUrl ?? '')`. `handleUpdate` passes `editThumbUrl.trim()` as the fourth arg to `election.updateElection`.
- **`loadElections`** — add `thumbnailUrl: e.thumbnailUrl` to the mapping.

The existing `getElection` destructure in `loadElections` reads named properties off the returned object (`e.id`, `e.name`, ...), so adding the new field doesn't shift indices — only the named access pattern needs the new property.

### `ResultsPage`

`ResultsPage` already accesses returned election fields by name (`current.state`, `current.id`), so the new `thumbnailUrl` field doesn't break it. No changes required.

## Out of scope

- Image upload from the browser; admin pastes a URL.
- Image validation, cropping, or resizing.
- Thumbnail rendering on `ElectionDetailPage` header.
- Thumbnail rendering on `ResultsPage`.
- Adding `thumbnailUrl` to the `ElectionUpdated` event signature.
- Migration of pre-existing on-chain data.

## Risks and trade-offs

- **Breaking ABI again.** Same redeploy + sync workflow as before. Tests in `Election.t.sol` need updating; every frontend caller of `createElection` / `updateElection` / `getElection` is touched.
- **External image dependence.** A broken or slow image URL drags the card. Mitigation: gradient fallback on `onError`. Lazy-loading via `loading="lazy"` on the `<img>` is also worth setting.
- **Aspect-ratio compatibility.** `aspect-ratio: 16 / 9` is supported in all modern browsers (>= 2021); the project doesn't target legacy browsers, so this is safe.

## Success criteria

- Admin can paste a thumbnail URL when creating or editing an election; the value persists across reloads.
- The `/vote` homepage renders elections in a responsive grid: 1 col mobile, 2-3 cols tablet, 3-4 cols desktop.
- Each card shows either the thumbnail image or a deterministic gradient fallback.
- Filter chips, click-to-navigate, and "View results →" link continue to work.
- Existing routes (`/admin`, `/results`, `/vote/:id`) keep working without regression.
- Foundry test suite remains green.
