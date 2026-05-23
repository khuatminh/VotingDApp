# IPFS image storage via Pinata — Design

**Status:** Draft
**Date:** 2026-05-22
**Author:** KhuaMin
**Scope:** Frontend-only change. No contract changes, no backend introduction.

---

## 1. Motivation

The voting dApp currently lets admins paste arbitrary image URLs (`thumbnailUrl` for elections, `imageUrl` for candidates) into the contract as raw strings. These URLs point to arbitrary external hosts, which means:

- Images can disappear (host goes down, file deleted, link rot) — leaving elections with broken thumbnails permanently recorded on chain.
- There is no constraint on file size, format, or content — admins could paste a URL to a 50 MB image, a non-image file, or a hot-linked third-party resource.
- The URL is opaque to the contract; nothing about it is content-addressable or verifiable.

This spec standardizes image storage by routing all admin uploads through **Pinata** (an IPFS pinning service). On-chain we still store a `string`, but going forward it will be `ipfs://<CID>` instead of an arbitrary URL. This gives us:

- Content-addressable URLs (immutable — the CID changes if the bytes change).
- A controlled upload pipeline with size + mime validation at the form layer.
- Demonstration of a Web3-native storage stack (relevant for the academic deliverable).

**Out of scope (explicitly):**
- Moving text metadata (`name`, `description`, `slogan`, `bio`) off-chain.
- User profiles, posts, search/filter infrastructure.
- Video or non-image file attachments.
- Contract changes or redeployment.
- A backend service.
- Migrating existing on-chain `imageUrl` / `thumbnailUrl` values.

## 2. Architecture overview

The project remains **2-tier**: Foundry contracts + React/Vite frontend. We add one external dependency: the **Pinata REST API** (`api.pinata.cloud`).

```
┌─────────────┐  upload file   ┌──────────┐   pin   ┌─────────┐
│  Frontend   │ ─────────────► │  Pinata  │ ──────► │  IPFS   │
│  (Admin)    │ ◄── { CID } ── │   API    │         │ network │
└──────┬──────┘                └──────────┘         └────┬────┘
       │                                                  │
       │ submit `ipfs://CID` as string                    │ HTTP fetch via gateway
       ▼                                                  │
┌─────────────┐                                           │
│  Contract   │   reads from chain                        │
│  (Election) │ ──────────────────────────────► Frontend │ render <img>
└─────────────┘                                           ▼
```

**Upload flow** (admin form submit):
1. Admin picks an image file in the form.
2. Frontend validates size (≤ 5 MB) and mime (`image/jpeg|png|webp|gif`).
3. Frontend POSTs `multipart/form-data` to `https://api.pinata.cloud/pinning/pinFileToIPFS` with header `Authorization: Bearer ${VITE_PINATA_JWT}`.
4. Pinata responds `{ IpfsHash: "Qm..." }`.
5. Frontend sets form state to `ipfs://Qm...`.
6. On form submit, this string is sent to the contract through the existing `createElection` / `updateElection` / `addCandidate` / `updateCandidate` paths. No contract code changes.

**Render flow** (any view):
- Helper `ipfsToHttp(url)` rewrites `ipfs://<CID>` → `https://gateway.pinata.cloud/ipfs/<CID>`. Inputs that are already HTTP(S) URLs (i.e. legacy data) pass through unchanged. Empty/null inputs return `''`.
- Every `<img src={...}>` for an `imageUrl` / `thumbnailUrl` is wrapped through this helper.

## 3. Components

### 3.1 `frontend/src/lib/ipfs.js` (new)

Pure JS module, no React imports. Exports:

```js
export const MAX_FILE_BYTES = 5 * 1024 * 1024;          // 5 MB
export const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
export const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export function ipfsToHttp(url) { ... }               // pure
export async function uploadToIpfs(file) { ... }      // returns 'ipfs://<CID>'
```

**`ipfsToHttp(url)`** — pure function:
- `'ipfs://Qm...'` → `'https://gateway.pinata.cloud/ipfs/Qm...'`
- `'https://...'` → unchanged
- `'http://...'` → unchanged
- `''`, `null`, `undefined` → `''`

**`uploadToIpfs(file)`** — async function:
- Throws if `!file`, `file.size > MAX_FILE_BYTES`, or `!ALLOWED_MIME.includes(file.type)`. Error messages in Vietnamese, user-facing.
- Throws if `!import.meta.env.VITE_PINATA_JWT` with a setup hint pointing to `.env.example`.
- Calls Pinata `pinFileToIPFS` via `fetch`. Reads `IpfsHash` from JSON response.
- Returns `'ipfs://' + IpfsHash` on success. Throws a descriptive error on HTTP non-2xx (401 → auth-specific message, others → generic with status code).

### 3.2 `frontend/src/components/ImageUploader.jsx` (new)

Controlled React component. Replaces every `<input type="text">` that currently captures an image URL in `AdminPage.jsx`.

**Props:**
- `value: string` — current value (`ipfs://...`, legacy `https://...`, or `''`).
- `onChange: (newUrl: string) => void` — called with the new `ipfs://...` after a successful upload, or `''` if the user clears.
- `label?: string` — optional field label.

**Render:**
- Preview area: if `value` is non-empty, render `<img src={ipfsToHttp(value)} />` with `onError` fallback to a neutral placeholder.
- "Chọn file" button (`<input type="file" accept="image/*">` styled as a button).
- Inline status: "Đang upload...", error message, or empty.
- Optional "Xoá ảnh" button if `value` is non-empty → calls `onChange('')`.

**Behavior:**
- On file pick: set `uploading = true`, call `uploadToIpfs(file)`, on success call `onChange(result)`, on error set `error = err.message`. Either way clear `uploading`.
- Replacing a file does not unpin the previous CID; the previous CID is simply no longer referenced from any form. (Acceptable on the free tier.)

### 3.3 `frontend/src/pages/AdminPage.jsx` (modified)

Four call sites to convert from `<input type="text">` to `<ImageUploader>`:

| Form | Existing line(s) | Change |
|---|---|---|
| Create election — thumbnail | `setThumbUrl(...)`, submit at L256 | Replace text input with `<ImageUploader value={thumbUrl} onChange={setThumbUrl} />` |
| Edit election — thumbnail | `setEditThumbUrl(...)` (L227), submit at L279 | Replace text input with `<ImageUploader value={editThumbUrl} onChange={setEditThumbUrl} />` |
| Create candidate — image | `setCImg(...)`, submit at L326 | Replace text input with `<ImageUploader value={cImg} onChange={setCImg} />` |
| Edit candidate — image | `setEcImg(...)` (L237), submit at L359 | Replace text input with `<ImageUploader value={ecImg} onChange={setEcImg} />` |

Drop `.trim()` calls on these specific URL fields — values are now machine-generated, never have whitespace.

### 3.4 Render-site rewrites (modified)

Every place that renders an `imageUrl` or `thumbnailUrl` gets a single-line change: `src={x}` → `src={ipfsToHttp(x)}`.

| File | Line | Field |
|---|---|---|
| `frontend/src/components/ElectionListCard.jsx` | 42 | `thumbnailUrl` |
| `frontend/src/components/ElectionDetailHeader.jsx` | 35 | `candidate.imageUrl` |
| `frontend/src/components/CandidateGridCard.jsx` | 25 | `candidate.imageUrl` |
| `frontend/src/components/CandidateDetailModal.jsx` | 29 | `candidate.imageUrl` |

`ResultsPage.jsx` puts `imageUrl` into its results array but does not actually render an `<img>` from it (the row card shows only name + vote count), so it requires no change.

The `useElection` / `useElectionDetail` hooks **do not** rewrite — they return raw on-chain values. Rewriting at the render leaf preserves the data shape and means a single grep (`ipfsToHttp`) finds every render site.

The `showImg = thumbnailUrl && ...` truthiness guards stay as-is — they check the raw string, which is what we want.

### 3.5 Env + docs (modified)

- `frontend/.env.example`: append
  ```dotenv
  # Pinata JWT for IPFS image uploads.
  # Get one at https://app.pinata.cloud/developers/api-keys
  # The JWT only needs `pinFileToIPFS` scope. WARNING: this value is inlined
  # into the frontend bundle and visible to all users — use a scoped key for
  # production, or proxy uploads through a backend.
  VITE_PINATA_JWT=
  ```
- `README.md` § 4 ("Configure environment files") — extend the `frontend/.env` table with a row for `VITE_PINATA_JWT` and a one-paragraph callout pointing to Pinata sign-up.

## 4. Contracts

**No changes.** `Election.sol` already stores `string thumbnailUrl` and `string imageUrl`. The on-chain semantics do not care about URL format. No ABI change, no redeployment, no migration.

## 5. Backwards compatibility

Legacy elections / candidates created before this feature shipped will have `imageUrl` / `thumbnailUrl` values like `https://example.com/foo.jpg`. The `ipfsToHttp` helper returns those unchanged, so existing rows continue to render exactly as before. No data migration is required.

If an existing legacy URL is later edited via the admin form, the admin must re-upload a file — there is no "keep current URL" affordance beyond the displayed preview. (The preview still renders, so the admin can decide whether to replace it.)

## 6. Error handling

### Validation (client-side, before any network call)
- File missing → "Vui lòng chọn một file."
- File > 5 MB → "File quá lớn (tối đa 5MB)."
- Mime not in `ALLOWED_MIME` → "Chỉ chấp nhận ảnh JPG/PNG/WebP/GIF."

### Pinata API
- 401 → "Pinata authentication failed — kiểm tra `VITE_PINATA_JWT`."
- Other non-2xx → "Upload thất bại (status N). Thử lại."
- Network error / fetch reject → "Upload thất bại — kiểm tra kết nối mạng."

### Env not set
- `!import.meta.env.VITE_PINATA_JWT` → throw immediately at the top of `uploadToIpfs`, before any fetch: "Chưa cấu hình Pinata JWT — xem `.env.example`."

### Render
- IPFS gateway returns 5xx / timeout → the existing `<img onError>` fallback (emoji placeholder) kicks in. No new code.
- Empty/null `imageUrl` → existing `showImg` truthiness guards return false, fallback placeholder renders. No new code.

## 7. Testing

### Unit (Vitest, frontend)
Add `frontend/src/lib/ipfs.test.js` covering `ipfsToHttp`:
- `ipfs://Qm...` → gateway URL with same CID.
- `https://...` → returns unchanged.
- `http://...` → returns unchanged.
- `''`, `null`, `undefined` → `''`.

`uploadToIpfs` is not unit-tested — it depends on network + a live Pinata key.

### Manual E2E
With local Anvil + Vite running:
1. As Anvil admin, navigate to `/admin`.
2. Open "Create election" form, pick a valid JPG file, observe upload spinner, observe preview after upload.
3. Submit; observe transaction succeeds.
4. Navigate to `/vote`; election thumbnail renders from IPFS gateway.
5. Repeat for candidate image (create + edit flows).
6. Edge case: pick a 6 MB file → expect inline error, no Pinata call.
7. Edge case: unset `VITE_PINATA_JWT`, restart Vite, attempt upload → expect inline setup error.
8. Backwards-compat: create an election the old way (via a previous build, or by directly calling the contract with an `https://...` URL) → confirm the new build still renders it via the unchanged passthrough.

### Contract tests
**No changes.** Existing Forge tests cover the contract surface; nothing about contract semantics changed.

## 8. Security notes

**Threat: leaked Pinata JWT.** `VITE_PINATA_JWT` is inlined into the production frontend bundle. Anyone who loads the dApp can read it from JS sources.

**Mitigation in scope:**
- Use a Pinata key scoped to **only** the `pinFileToIPFS` permission — no `unpin`, no `pinList`, no `userPinPolicy`.
- Free-tier quota caps the blast radius: a malicious actor can upload trash up to the quota, then uploads stop. They cannot delete pinned files or read user data.
- Document the limitation explicitly in `.env.example` and README so anyone deploying knows this is a demo posture.

**Out of scope for this spec:**
- Proxying uploads through a backend to keep the JWT server-side. This is the right move for a production deployment and is called out as a follow-up, but it requires introducing a backend (which we agreed is out of scope for this iteration).
- Rate-limiting client-side uploads.
- Content moderation / image scanning.

## 9. Open follow-ups (not in scope)

- Backend upload proxy (production-grade JWT hiding).
- Pin management UI (list / unpin orphaned CIDs).
- Alternative pinning provider (web3.storage, NFT.storage) as a fallback.
- Video / file attachments (would require contract changes).
- Off-chain text metadata (would require contract changes).
