# IPFS image storage via Pinata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize election thumbnail + candidate image uploads through Pinata so on-chain string fields hold `ipfs://<CID>` going forward, with zero contract changes.

**Architecture:** Frontend-only. Admin forms upload files to Pinata REST API directly from the browser. On-chain `string` fields keep storing the same URL shape; new uploads produce `ipfs://<CID>`, legacy `https://...` values pass through a render-time helper unchanged.

**Tech Stack:** React 18, Vite 5, Pinata REST API (`api.pinata.cloud/pinning/pinFileToIPFS`), Vitest (added in Task 1) for unit testing the pure helper.

**Spec:** [docs/superpowers/specs/2026-05-22-ipfs-image-storage-design.md](../specs/2026-05-22-ipfs-image-storage-design.md)

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `frontend/package.json` | Modify | Add `vitest` + `test` script |
| `frontend/vite.config.js` | Modify | Add Vitest config block |
| `frontend/src/lib/ipfs.js` | Create | `ipfsToHttp()` + `uploadToIpfs()` + constants |
| `frontend/src/lib/ipfs.test.js` | Create | Unit tests for `ipfsToHttp()` |
| `frontend/src/components/ImageUploader.jsx` | Create | File-picker + Pinata upload + preview |
| `frontend/src/pages/AdminPage.jsx` | Modify | Replace 4 URL `<input>`s with `<ImageUploader>` |
| `frontend/src/components/ElectionListCard.jsx` | Modify | Wrap thumbnail `src` in `ipfsToHttp` |
| `frontend/src/components/ElectionDetailHeader.jsx` | Modify | Wrap candidate image `src` in `ipfsToHttp` |
| `frontend/src/components/CandidateGridCard.jsx` | Modify | Wrap candidate image `src` in `ipfsToHttp` |
| `frontend/src/components/CandidateDetailModal.jsx` | Modify | Wrap candidate image `src` in `ipfsToHttp` |
| `frontend/.env.example` | Modify | Add `VITE_PINATA_JWT` row + comment |
| `README.md` | Modify | Add Pinata JWT row to env table |

---

## Task 1: Set up Vitest

**Why:** The frontend has zero test infrastructure today. Task 2 ships a pure helper that the spec requires we unit-test, so we add Vitest first as a tiny standalone task.

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`

- [ ] **Step 1: Install Vitest as dev dep**

Run from repo root:
```bash
cd frontend && npm install --save-dev vitest@^2.0.0 && cd ..
```

Expected: `package.json` gains `"vitest": "^2.0.0"` under `devDependencies`, `package-lock.json` updated, no errors.

- [ ] **Step 2: Add `test` script to package.json**

Edit `frontend/package.json` — extend the `scripts` block from:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```
to:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Configure Vitest in vite.config.js**

Read `frontend/vite.config.js` first to see the current shape, then add a `test` block at the same level as `plugins`. The final file should look like (adjust to match the existing `plugins` array exactly):

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
```

(If `defineConfig` is not already imported in the existing file, add the import. Keep any other existing config keys.)

- [ ] **Step 4: Verify Vitest runs against an empty test suite**

Run:
```bash
cd frontend && npm test
```

Expected: Exits 0 with "No test files found, exiting with code 0" or equivalent — Vitest is installed and configured. (It does NOT exit non-zero for "no tests found" in the `vitest run` mode we configured.)

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js
git commit -m "chore(frontend): add vitest"
```

---

## Task 2: `ipfsToHttp()` — pure function with tests

**Files:**
- Create: `frontend/src/lib/ipfs.js`
- Create: `frontend/src/lib/ipfs.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/ipfs.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ipfsToHttp, PINATA_GATEWAY } from './ipfs.js';

describe('ipfsToHttp', () => {
  it('rewrites ipfs:// URIs to the Pinata gateway', () => {
    expect(ipfsToHttp('ipfs://QmXyz123')).toBe(`${PINATA_GATEWAY}QmXyz123`);
  });

  it('passes https:// URLs through unchanged', () => {
    expect(ipfsToHttp('https://example.com/foo.jpg')).toBe('https://example.com/foo.jpg');
  });

  it('passes http:// URLs through unchanged', () => {
    expect(ipfsToHttp('http://example.com/foo.jpg')).toBe('http://example.com/foo.jpg');
  });

  it('returns empty string for empty/null/undefined input', () => {
    expect(ipfsToHttp('')).toBe('');
    expect(ipfsToHttp(null)).toBe('');
    expect(ipfsToHttp(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
cd frontend && npm test
```

Expected: FAIL — "Cannot find module './ipfs.js'" or similar import error.

- [ ] **Step 3: Implement `ipfs.js` with constants + `ipfsToHttp`**

Create `frontend/src/lib/ipfs.js`:

```js
// Pinata-based IPFS upload + gateway helpers.
// See docs/superpowers/specs/2026-05-22-ipfs-image-storage-design.md

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const PINATA_PIN_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

/**
 * Rewrite an `ipfs://<CID>` URI to a public Pinata gateway URL.
 * Non-IPFS inputs (http/https/empty/null) are returned unchanged (or as '').
 */
export function ipfsToHttp(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('ipfs://')) {
    return PINATA_GATEWAY + url.slice('ipfs://'.length);
  }
  return url;
}
```

(We are NOT implementing `uploadToIpfs` in this task — it gets its own task with no unit tests.)

- [ ] **Step 4: Run tests, confirm they pass**

```bash
cd frontend && npm test
```

Expected: PASS — 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ipfs.js frontend/src/lib/ipfs.test.js
git commit -m "feat(frontend): add ipfsToHttp helper"
```

---

## Task 3: `uploadToIpfs()` — Pinata REST client

**Why no unit test:** This function depends on `fetch` + a live Pinata JWT. Unit-testing it well requires mocking `fetch`, which is high-friction for a one-call function. We rely on the manual E2E in Task 9 instead.

**Files:**
- Modify: `frontend/src/lib/ipfs.js` (append the function)

- [ ] **Step 1: Append `uploadToIpfs` to `ipfs.js`**

Open `frontend/src/lib/ipfs.js` and append below `ipfsToHttp`:

```js
/**
 * Upload a single image file to Pinata. Validates size + mime before any network call.
 * Returns `ipfs://<CID>` on success. Throws Error with a user-facing Vietnamese message on failure.
 */
export async function uploadToIpfs(file) {
  if (!file) {
    throw new Error('Vui lòng chọn một file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File quá lớn (tối đa 5MB).');
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh JPG/PNG/WebP/GIF.');
  }

  const jwt = import.meta.env.VITE_PINATA_JWT;
  if (!jwt) {
    throw new Error('Chưa cấu hình Pinata JWT — xem `.env.example`.');
  }

  const form = new FormData();
  form.append('file', file);

  let res;
  try {
    res = await fetch(PINATA_PIN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
  } catch (_err) {
    throw new Error('Upload thất bại — kiểm tra kết nối mạng.');
  }

  if (res.status === 401) {
    throw new Error('Pinata authentication failed — kiểm tra `VITE_PINATA_JWT`.');
  }
  if (!res.ok) {
    throw new Error(`Upload thất bại (status ${res.status}). Thử lại.`);
  }

  const data = await res.json();
  if (!data.IpfsHash) {
    throw new Error('Pinata không trả về CID. Thử lại.');
  }
  return `ipfs://${data.IpfsHash}`;
}
```

- [ ] **Step 2: Re-run the existing test suite to confirm nothing broke**

```bash
cd frontend && npm test
```

Expected: 4 tests still pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/ipfs.js
git commit -m "feat(frontend): add uploadToIpfs Pinata client"
```

---

## Task 4: `<ImageUploader>` component

**Files:**
- Create: `frontend/src/components/ImageUploader.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ImageUploader.jsx`:

```jsx
import { useRef, useState } from 'react';
import { ipfsToHttp, uploadToIpfs } from '../lib/ipfs.js';

/**
 * Controlled image uploader. Persists nothing of its own — emits the
 * final `ipfs://<CID>` (or `''`) to the parent through onChange.
 *
 * Props:
 *   value:    string  — current url (ipfs://, https://, or '')
 *   onChange: (newUrl: string) => void
 *   label?:   string  — optional field label
 */
export default function ImageUploader({ value, onChange, label }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleFile(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';                              // allow re-picking the same file later
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadToIpfs(file);
      onChange(url);
    } catch (err) {
      setError(err.message || 'Upload thất bại.');
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    setError('');
    onChange('');
  }

  const previewSrc = ipfsToHttp(value);

  return (
    <div className="image-uploader">
      {label && <label>{label}</label>}

      {previewSrc && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={previewSrc}
            alt=""
            style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Đang upload…' : (value ? 'Đổi ảnh' : 'Chọn file')}
        </button>
        {value && !uploading && (
          <button type="button" className="btn btn-sm" onClick={handleClear}>
            Xoá ảnh
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: '0.85rem', marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles by running the dev build**

```bash
cd frontend && npm run build
```

Expected: build succeeds (no syntax / import errors). Component is not wired into any page yet, so it won't appear in the UI.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ImageUploader.jsx
git commit -m "feat(frontend): add ImageUploader component"
```

---

## Task 5: Wire `<ImageUploader>` into the four AdminPage forms

**Files:**
- Modify: `frontend/src/pages/AdminPage.jsx`

There are four call sites. Each one swaps an `<input type="text">` for `<ImageUploader>`. The state variables and submit handlers stay exactly the same — the new component just emits the same string the input used to.

- [ ] **Step 1: Import the component**

At the top of `frontend/src/pages/AdminPage.jsx`, after the existing imports, add:

```js
import ImageUploader from '../components/ImageUploader.jsx';
```

- [ ] **Step 2: Replace create-election thumbnail input (around line 434–438)**

Find:
```jsx
          <div className="field" style={{ marginTop: 12 }}>
            <label>Thumbnail URL</label>
            <input className="input" value={thumbUrl} onChange={e => setThumbUrl(e.target.value)}
              placeholder="https://… (optional)" />
          </div>
```

Replace with:
```jsx
          <div className="field" style={{ marginTop: 12 }}>
            <ImageUploader label="Thumbnail" value={thumbUrl} onChange={setThumbUrl} />
          </div>
```

- [ ] **Step 3: Replace edit-election thumbnail input (around line 521–526)**

Find:
```jsx
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Thumbnail URL</label>
                  <input className="input" value={editThumbUrl}
                    onChange={ev => setEditThumbUrl(ev.target.value)}
                    placeholder="https://… (optional)" />
                </div>
```

Replace with:
```jsx
                <div className="field" style={{ marginTop: 12 }}>
                  <ImageUploader label="Thumbnail" value={editThumbUrl} onChange={setEditThumbUrl} />
                </div>
```

- [ ] **Step 4: Replace add-candidate image input (around line 560–564)**

Find:
```jsx
                  <div className="field">
                    <label>Image URL</label>
                    <input className="input" value={cImg} onChange={ev => setCImg(ev.target.value)}
                      placeholder="https://…" />
                  </div>
```

Replace with:
```jsx
                  <div className="field">
                    <ImageUploader label="Image" value={cImg} onChange={setCImg} />
                  </div>
```

- [ ] **Step 5: Replace edit-candidate image input (around line 649–654)**

Find:
```jsx
                              <div className="field">
                                <label>Image URL</label>
                                <input className="input" value={ecImg}
                                  onChange={ev => setEcImg(ev.target.value)}
                                  placeholder="https://…" />
                              </div>
```

Replace with:
```jsx
                              <div className="field">
                                <ImageUploader label="Image" value={ecImg} onChange={setEcImg} />
                              </div>
```

- [ ] **Step 6: Drop `.trim()` on the image URL fields in submit handlers**

Per the spec, values are now machine-generated and never contain whitespace. Edit the four call sites in `AdminPage.jsx`:

| Line (current) | Before | After |
|---|---|---|
| ~250 | `election.createElection(name.trim(), desc.trim(), thumbUrl.trim())` | `election.createElection(name.trim(), desc.trim(), thumbUrl)` |
| ~256 | `thumbnailUrl: thumbUrl.trim(),` | `thumbnailUrl: thumbUrl,` |
| ~273 | `editThumbUrl.trim()` | `editThumbUrl` |
| ~279 | `thumbnailUrl: editThumbUrl.trim()` | `thumbnailUrl: editThumbUrl` |
| ~311 | `cImg.trim()` (last arg to `addCandidate`) | `cImg` |
| ~326 | `imageUrl: cImg.trim(),` | `imageUrl: cImg,` |
| ~345 | `ecImg.trim()` (last arg of the call) | `ecImg` |
| ~359 | `imageUrl: ecImg.trim(),` | `imageUrl: ecImg,` |

Leave `.trim()` on `name`, `description`, `slogan`, `bio`, etc. — those are still user-typed text inputs.

- [ ] **Step 7: Verify the build still passes**

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/AdminPage.jsx
git commit -m "feat(frontend): wire ImageUploader into admin forms"
```

---

## Task 6: Render IPFS-aware images everywhere

**Files:**
- Modify: `frontend/src/components/ElectionListCard.jsx`
- Modify: `frontend/src/components/ElectionDetailHeader.jsx`
- Modify: `frontend/src/components/CandidateGridCard.jsx`
- Modify: `frontend/src/components/CandidateDetailModal.jsx`

Each file gets one import + one `src=` rewrite. Do them together because the change is uniform.

- [ ] **Step 1: ElectionListCard**

In `frontend/src/components/ElectionListCard.jsx`:

Add to imports (top of file):
```js
import { ipfsToHttp } from '../lib/ipfs.js';
```

Change line 42:
```jsx
            src={thumbnailUrl}
```
to:
```jsx
            src={ipfsToHttp(thumbnailUrl)}
```

- [ ] **Step 2: ElectionDetailHeader**

In `frontend/src/components/ElectionDetailHeader.jsx`:

Add to imports:
```js
import { ipfsToHttp } from '../lib/ipfs.js';
```

Change line 35:
```jsx
        src={candidate.imageUrl}
```
to:
```jsx
        src={ipfsToHttp(candidate.imageUrl)}
```

- [ ] **Step 3: CandidateGridCard**

In `frontend/src/components/CandidateGridCard.jsx`:

Add to imports:
```js
import { ipfsToHttp } from '../lib/ipfs.js';
```

Change line 25:
```jsx
          src={candidate.imageUrl}
```
to:
```jsx
          src={ipfsToHttp(candidate.imageUrl)}
```

- [ ] **Step 4: CandidateDetailModal**

In `frontend/src/components/CandidateDetailModal.jsx`:

Add to imports:
```js
import { ipfsToHttp } from '../lib/ipfs.js';
```

Change line 29:
```jsx
            <img src={candidate.imageUrl} alt={candidate.name} className="modal__avatar" />
```
to:
```jsx
            <img src={ipfsToHttp(candidate.imageUrl)} alt={candidate.name} className="modal__avatar" />
```

- [ ] **Step 5: Verify build + tests**

```bash
cd frontend && npm run build && npm test
```

Expected: build succeeds, 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ElectionListCard.jsx \
        frontend/src/components/ElectionDetailHeader.jsx \
        frontend/src/components/CandidateGridCard.jsx \
        frontend/src/components/CandidateDetailModal.jsx
git commit -m "feat(frontend): rewrite ipfs:// to gateway at render sites"
```

---

## Task 7: Env example + README

**Files:**
- Modify: `frontend/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example`**

Append to `frontend/.env.example` (after the existing `VITE_SEPOLIA_RPC=` line):

```
# Pinata JWT for IPFS image uploads.
# Get one at https://app.pinata.cloud/developers/api-keys
# The JWT only needs `pinFileToIPFS` scope. WARNING: this value is inlined
# into the frontend bundle and visible to all users — use a scoped key for
# production, or proxy uploads through a backend.
VITE_PINATA_JWT=
```

- [ ] **Step 2: Update README env table**

Open `README.md` and find the `frontend/.env` table in section 4. It currently reads:

```markdown
| Variable | Default | Notes |
|---|---|---|
| `VITE_DEFAULT_CHAIN_ID` | `31337` | `31337` = Anvil, `11155111` = Sepolia. |
| `VITE_SEPOLIA_RPC` | empty | Optional explicit Sepolia RPC; otherwise the app uses MetaMask's provider. |
```

Replace with:

```markdown
| Variable | Default | Notes |
|---|---|---|
| `VITE_DEFAULT_CHAIN_ID` | `31337` | `31337` = Anvil, `11155111` = Sepolia. |
| `VITE_SEPOLIA_RPC` | empty | Optional explicit Sepolia RPC; otherwise the app uses MetaMask's provider. |
| `VITE_PINATA_JWT` | empty | Required for admins to upload election/candidate images. Create a JWT with only `pinFileToIPFS` scope at https://app.pinata.cloud/developers/api-keys. **Inlined into the frontend bundle** — treat as public; for production use a backend proxy instead. |
```

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.example README.md
git commit -m "docs: document VITE_PINATA_JWT setup"
```

---

## Task 8: Manual end-to-end verification

**This task is not committed — it's a verification gate before declaring the feature done.**

- [ ] **Step 1: Configure a real Pinata JWT**

In `frontend/.env`, set:
```
VITE_PINATA_JWT=<a real JWT from https://app.pinata.cloud/developers/api-keys, with only the pinFileToIPFS scope>
```

If you don't have a Pinata account: sign up (free tier is enough), create a new key, copy the JWT (a long string starting with `eyJ...`).

- [ ] **Step 2: Run the full local stack**

```bash
npm run dev
```

Expected: Anvil + contracts + Vite all up. Frontend at http://localhost:5173.

- [ ] **Step 3: Happy path — create election with thumbnail upload**

1. Connect MetaMask as Anvil Admin (Account #0).
2. Go to `/admin`, click "Create election".
3. Fill name + description.
4. In the Thumbnail field, click "Chọn file", pick a small JPG/PNG (< 5 MB).
5. Observe the button switch to "Đang upload…", then back to "Đổi ảnh" with a preview image showing.
6. Open Pinata dashboard in another tab — confirm the file appears under "Files".
7. Submit the form. Wait for tx confirmation.
8. Navigate to the election list / vote page. Confirm the thumbnail renders (it should — fetched from `gateway.pinata.cloud`).

- [ ] **Step 4: Happy path — candidate image**

Same flow but for "Add candidate" inside an election. Confirm the image renders in CandidateGridCard, CandidateDetailModal (click the candidate), and ElectionDetailHeader.

- [ ] **Step 5: Validation — oversize file**

Try to pick a file > 5 MB. Expected: red inline error "File quá lớn (tối đa 5MB)." No Pinata call is made (verify by leaving the Pinata dashboard open — no new file appears).

- [ ] **Step 6: Validation — wrong mime**

Try to pick a non-image file (e.g. a `.txt`). The browser file picker filters to images so this is hard to do via UI — to test programmatically, you can use the browser devtools to remove the `accept="image/*"` attribute first, then pick a `.txt`. Expected: red inline error "Chỉ chấp nhận ảnh JPG/PNG/WebP/GIF."

- [ ] **Step 7: Setup error — missing JWT**

Stop Vite. Clear `VITE_PINATA_JWT=` in `frontend/.env`. Restart Vite. Try to upload. Expected: red inline error "Chưa cấu hình Pinata JWT — xem `.env.example`."

Restore the JWT before continuing.

- [ ] **Step 8: Backwards compat — legacy URL renders**

There are two ways to verify:

**Easier:** edit an election via the admin form, but instead of using the uploader, open browser devtools and modify the `editThumbUrl` state to a legacy `https://...` URL pointing to any public image. Confirm the preview + list card renders it through the unchanged passthrough.

**More thorough:** use `cast send` from the `contracts/` directory to call `updateElection` directly with an `https://...` thumbnailUrl, then reload the frontend and confirm the card renders.

- [ ] **Step 9: Stop dev stack and verify state**

`Ctrl-C` the dev script. Confirm no orphaned `anvil` processes (`pgrep anvil`).

---

## Task 9: Final commit (if anything was tweaked during E2E)

- [ ] **Step 1: `git status` — anything modified?**

```bash
git status
```

If clean: done, skip the rest of this task.

If anything was changed during E2E (e.g. you spotted a typo in an error message), stage + commit it.

- [ ] **Step 2: If needed, commit**

```bash
git add <files>
git commit -m "fix(frontend): <one-line description>"
```

---

## Acceptance criteria

- `npm test` in `frontend/` passes 4 tests (`ipfsToHttp` cases).
- `npm run build` in `frontend/` succeeds.
- All four admin forms (create election, edit election, add candidate, edit candidate) show an "Chọn file" button instead of a URL text input, accept an image upload, and submit the resulting `ipfs://...` to the contract.
- All four render sites (ElectionListCard, ElectionDetailHeader, CandidateGridCard, CandidateDetailModal) render `ipfs://...` values through the Pinata gateway, AND render legacy `https://...` values unchanged.
- README and `.env.example` document `VITE_PINATA_JWT` setup, including the public-bundle warning.
- Contracts are untouched (no entries under `contracts/` in `git diff main`).
