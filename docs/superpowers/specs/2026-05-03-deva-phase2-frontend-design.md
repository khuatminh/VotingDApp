# Dev A Phase 2 — Frontend Design

**Author:** Dev A  
**Date:** 2026-05-03  
**Status:** Approved

---

## Goal

Fill every `TODO(Dev A)` in the frontend scaffold: `wallet.js`, `useWallet.js`, `useContract.js`, `Layout.jsx`, `ConnectButton.jsx`, and `AdminPage.jsx`. Apply the web3-native dark visual system from the user's design prototype (`VotingDApp.html`). The result is a fully wired frontend that Dev B can build on top of immediately.

## Architecture

**Layer stack:**

```
index.css          ← full design system (CSS variables, classes, overlays)
wallet.js          ← pure MetaMask helpers, no React
useWallet.js       ← React state over wallet.js
useContract.js     ← ethers.Contract instances + isAdmin flag
Layout.jsx         ← Topbar (brand, nav, wallet pill) + <Outlet />
ConnectButton.jsx  ← consumed by Topbar; connect button or wallet pill
App.jsx            ← routes + toast state + pendingTx state + overlay renders
AdminPage.jsx      ← three-tab admin dashboard, inline tx handlers
```

**State model:**  
- Wallet state (`address`, `chainId`) lives in `useWallet` — single subscriber pattern via `window.ethereum` events.  
- Contract instances live in `useContract` — re-created when wallet state changes.  
- Toast list + pending-tx ribbon live in `App.jsx` — passed down to AdminPage as `pushToast` + `setPendingTx` props.  
- AdminPage data (`elections`, `admins`, `voters`) lives in AdminPage local state — loaded from chain on mount, updated optimistically after each confirmed transaction.

**Transaction lifecycle (Option 1 — inline handlers):**  
Each action button has its own `async` handler and `loading` boolean. Pattern:
1. `setLoading(true)`
2. Call contract method → get tx
3. `setPendingTx({ label, hash: tx.hash })`
4. `await tx.wait()`
5. Optimistic state update
6. `pushToast(msg, 'success')`
7. On catch: `pushToast(e.reason ?? e.message, 'error')`
8. Finally: `setLoading(false)`, `setPendingTx(null)`

---

## Files

```
frontend/
  index.html                      ← add Google Fonts link (Geist, Geist Mono)
  src/
    index.css                     ← replace entirely with design system
    App.jsx                       ← add toast + pendingTx state + overlays
    lib/wallet.js                 ← implement all TODOs
    hooks/useWallet.js            ← implement all TODOs
    hooks/useContract.js          ← implement all TODOs
    components/Layout.jsx         ← replace skeleton with Topbar + Outlet
    components/ConnectButton.jsx  ← replace skeleton with connect/wallet-pill
    pages/AdminPage.jsx           ← replace skeleton with full three-tab UI
```

All other files are read-only for this plan (Dev B's scope: `ElectionSelector`, `CandidateCard`, `AddressBadge`, `VotePage`, `ResultsPage`).

---

## Section 1 — Visual system (`index.css` + `index.html`)

### `index.html` change
Add Google Fonts preconnect + stylesheet in `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### CSS design tokens (`:root`)

| Variable | Dark value | Light value | Purpose |
|---|---|---|---|
| `--bg` | `#07070a` | `#f3f3f0` | Page background |
| `--bg-2` | `#0c0c11` | `#ebebe7` | Secondary background |
| `--paper` | `#0f0f15` | `#ffffff` | Card/modal background |
| `--card` | `rgba(255,255,255,.03)` | `rgba(0,0,0,.02)` | Glass card fill |
| `--card-solid` | `#14141c` | `#ffffff` | Solid card fill |
| `--ink` | `#f1efea` | `#07070a` | Primary text |
| `--ink-2` | `#b9b6ad` | `#3a3a44` | Secondary text |
| `--ink-3` | `#6f6c66` | `#76736b` | Muted text |
| `--ink-4` | `#3a3a44` | `#b8b3a6` | Disabled text |
| `--line` | `rgba(255,255,255,.06)` | `rgba(0,0,0,.06)` | Hairline border |
| `--line-2` | `rgba(255,255,255,.12)` | `rgba(0,0,0,.12)` | Visible border |
| `--accent` | `#c2ff3d` | `#4d8b00` | Electric lime — primary CTA |
| `--accent-2` | `#7c5cff` | — | Violet — secondary accent |
| `--accent-3` | `#ff5cf2` | — | Magenta — tertiary |
| `--accent-soft` | `rgba(194,255,61,.12)` | `rgba(77,139,0,.10)` | Accent tint for focus rings |
| `--good` | `#6effb0` | `#1d7a45` | Success green |
| `--bad` | `#ff6e7e` | `#c8332a` | Error red |
| `--warn` | `#ffb960` | — | Warning amber |
| `--sans` | `'Geist', ui-sans-serif, system-ui, sans-serif` | — | UI font |
| `--mono` | `'Geist Mono', ui-monospace, Menlo, monospace` | — | Mono font (addresses, badges, nav) |
| `--r-sm/md/lg/xl` | `6px / 12px / 20px / 28px` | — | Border radius scale |

Theme switching: `document.documentElement.dataset.theme = 'light'` activates `html[data-theme="light"]` overrides. Default: dark.

### Body treatment
- Radial glow: `background-image: radial-gradient(60% 40% at 80% 0%, rgba(124,92,255,.18), transparent 70%), radial-gradient(40% 30% at 10% 10%, rgba(194,255,61,.10), transparent 70%)`
- Grid backdrop via `body::before`: 64×64px grid lines in `var(--line)`, masked radially with `mask-image: radial-gradient(80% 60% at 50% 30%, black, transparent 80%)`.
- `background-attachment: fixed` so grid + glows stay fixed on scroll.

### Component classes

**Buttons:** `.btn` (base, glass + backdrop-blur), `.btn-primary` (ink on bg), `.btn-accent` (lime fill + neon glow shadow), `.btn-ghost`, `.btn-danger`, `.btn-sm` (h:32px), `.btn-lg` (h:52px).

**Inputs:** `.input`, `.textarea`, `.select` — mono font, `background: var(--card-solid)`, lime focus ring (`box-shadow: 0 0 0 3px var(--accent-soft)`). `.field` wraps label + input.

**Badges:** `.badge.badge-open` (lime dot + glass), `.badge.badge-ended` (ink-3 color), `.badge.badge-notstarted` (ink-4 color).

**Layout shell:** `.shell` (min-height 100vh flex column), `.container` (max-width 1280px, auto margin, 32px horizontal padding, responsive to 20px).

**Page animation:** `.page { animation: pageIn .35s cubic-bezier(.2,.8,.2,1) }` — fade-up from 8px.

**Topbar:** `.top` (sticky, z-50, glass blur), `.top-inner` (3-column grid: brand | nav | right). `.brand` (mono uppercase + gradient mark). `.top-nav` (glass pill container, mono buttons). `.net-pill` (pulsing dot indicator). `.wallet` (address + avatar pill).

**Overlays:**
- `.toast-wrap` — fixed bottom-right, stacked toasts slide up.
- `.toast.success` / `.toast.error` — colored left border, slide-in animation.
- `.tx-ribbon` — fixed top (below topbar), pending state with spinner + tx hash.

**Admin-specific:** `.admin-page` (padding 40px 0), `.subtabs` (same glass pill style as top-nav), `.subtab.active` (lime background), `.row-card` (flex card for election rows), `.form-card` (glass card for forms), `.tbl` (table with `var(--line)` borders), `.grid-2` / `.grid-3` (responsive CSS grid), `.alert.alert-info`.

---

## Section 2 — `wallet.js`

Implement all 6 exported functions. No React. No state.

```js
export function hasMetaMask() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export function getProvider() {
  if (!hasMetaMask()) return null;
  return new BrowserProvider(window.ethereum);
}

export async function connect() {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask not installed');
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return await signer.getAddress();
}

export async function getSigner() {
  const provider = getProvider();
  if (!provider) return null;
  try {
    return await provider.getSigner();
  } catch {
    return null;
  }
}

export async function getChainId() {
  const provider = getProvider();
  if (!provider) return null;
  const net = await provider.getNetwork();
  return Number(net.chainId);
}

export async function switchChain(chainIdHex) {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  } catch (err) {
    if (err.code === 4902) {
      // wallet_addEthereumChain fallback — caller must supply chain params
      throw err;
    }
    throw err;
  }
}

export function onAccountOrChainChange(handler) {
  if (!hasMetaMask()) return () => {};
  window.ethereum.on('accountsChanged', handler);
  window.ethereum.on('chainChanged', handler);
  return () => {
    window.ethereum.removeListener('accountsChanged', handler);
    window.ethereum.removeListener('chainChanged', handler);
  };
}
```

---

## Section 3 — `useWallet.js`

```js
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);

  const refresh = useCallback(async () => {
    const signer = await wallet.getSigner();
    if (!signer) { setAddress(null); setChainId(null); return; }
    setAddress(await signer.getAddress());
    setChainId(await wallet.getChainId());
  }, []);

  useEffect(() => {
    const unsub = wallet.onAccountOrChainChange(refresh);
    refresh();
    return unsub;
  }, [refresh]);

  const connect = useCallback(async () => {
    await wallet.connect();
    await refresh();
  }, [refresh]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  return { address, chainId, isConnected: !!address, connect, disconnect };
}
```

---

## Section 4 — `useContract.js`

On `[address, chainId, isConnected]` change:
1. If not connected → reset everything to null/false and return.
2. Resolve `chainKey = String(chainId)`. Look up `addresses[chainKey]`.
3. Get signer from `wallet.getSigner()`.
4. Construct `new Contract(addresses[chainKey].voterRegistry, voterRegistryAbi.abi, signer)`.
5. Construct `new Contract(addresses[chainKey].election, electionAbi.abi, signer)`.
6. Call `voterRegistry.isAdmin(address)` → `setIsAdmin(bool)`.
7. On error (unknown chainId, RPC failure): log and leave contracts null.

Uncomment the ABI imports after first `forge build` + `sync-abi.sh` run.

`ready` is `true` when both contract instances are non-null.

---

## Section 5 — `Layout.jsx`

Replace the skeleton with the Topbar design. Layout uses `useWallet()` and `useContract()` internally.

**Structure:**
```jsx
<div className="shell">
  <header className="top">
    <div className="top-inner container">
      <Brand />                    {/* left: gradient mark + "Polis" */}
      <nav className="top-nav">   {/* center: pill nav */}
        <NavLink to="/vote">Vote</NavLink>
        <NavLink to="/results">Results</NavLink>
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="top-right"> {/* right: network pill + ConnectButton */}
        {chainId && <NetworkPill chainId={chainId} />}
        <ConnectButton />
      </div>
    </div>
  </header>
  <main className="layout__main">
    <Outlet />
  </main>
</div>
```

`NavLink` active class: use `className={({ isActive }) => isActive ? 'active' : ''}`.

`NetworkPill`: reads `NETWORKS[chainId]?.name` from `src/config/networks.js`. Shows pulsing green dot + network name in mono uppercase.

`Brand`: `div.brand-mark` (CSS gradient + ring) + `span` "Polis" in mono uppercase.

---

## Section 6 — `ConnectButton.jsx`

```jsx
export default function ConnectButton() {
  const { address, isConnected, connect } = useWallet();
  const [error, setError] = useState(null);

  async function handleConnect() {
    setError(null);
    try { await connect(); }
    catch (e) { setError('MetaMask not found or rejected'); }
  }

  if (isConnected) {
    return (
      <span className="wallet">
        <span className="mono">{shortAddr(address, 4, 4)}</span>
        <span className="avatar" />
      </span>
    );
  }
  return (
    <div>
      <button className="btn btn-primary btn-sm" onClick={handleConnect}>Connect</button>
      {error && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
```

`shortAddr(addr, n, m)` helper: `addr.slice(0,2+n) + '…' + addr.slice(-m)` — defined as a local util in `src/lib/utils.js` (new file).

---

## Section 7 — `App.jsx`

Add toast + pendingTx state. Render overlays above routes. Pass props to AdminPage.

```jsx
export default function App() {
  const [toasts, setToasts] = useState([]);
  const [pendingTx, setPendingTx] = useState(null);
  const toastSeq = useRef(0);

  function pushToast(msg, kind) {
    const id = ++toastSeq.current;
    setToasts(ts => [...ts, { id, msg, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3500);
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/vote" replace />} />
          <Route path="admin" element={<AdminPage pushToast={pushToast} setPendingTx={setPendingTx} />} />
          <Route path="vote" element={<VotePage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/vote" replace />} />
        </Route>
      </Routes>
      <Toasts toasts={toasts} />
      {pendingTx && <PendingTxRibbon tx={pendingTx} />}
    </>
  );
}
```

`Toasts` and `PendingTxRibbon` are simple presentational components defined in `src/components/Toasts.jsx` and `src/components/PendingTxRibbon.jsx`.

---

## Section 8 — `AdminPage.jsx`

### Data loading on mount

```js
const { voterRegistry, election, isAdmin, ready } = useContract();

const [elections, setElections] = useState([]);    // { id, name, description, creator, state, candidateCount }
const [admins, setAdmins] = useState([]);           // { addr, grantedAt, grantedBy }
const [voters, setVoters] = useState({});           // { [electionId]: string[] }
const [loading, setLoading] = useState(true);
```

**`loadElections()`:**
```js
const count = Number(await election.electionCount());
const list = await Promise.all(
  Array.from({ length: count }, (_, i) => election.getElection(i + 1))
);
setElections(list.map(e => ({ id: Number(e.id), name: e.name, ... })));
// elections.length after this call == electionCount on chain (IDs are 1-indexed, sequential)
```

**`loadAdmins()`:** Query `RoleGranted` + `RoleRevoked` events from block 0 on both contracts. Build set per contract, intersect. Cache `ADMIN_ROLE` hash in a `useRef` for reuse by grant/revoke handlers:
```js
const ADMIN_ROLE = await voterRegistry.ADMIN_ROLE(); // store in adminRoleRef.current
const granted = await voterRegistry.queryFilter(voterRegistry.filters.RoleGranted(ADMIN_ROLE), 0);
const revoked = await voterRegistry.queryFilter(voterRegistry.filters.RoleRevoked(ADMIN_ROLE), 0);
// build set: granted addresses minus revoked addresses
```
Repeat for `election` contract, intersect both sets → `setAdmins([...])`.

**`loadVoters(electionId)`** (called lazily when Voters tab is selected):
```js
const authorized = await voterRegistry.queryFilter(voterRegistry.filters.VoterAuthorized(electionId), 0);
const revoked    = await voterRegistry.queryFilter(voterRegistry.filters.VoterRevoked(electionId), 0);
// build current set
setVoters(prev => ({ ...prev, [electionId]: [...currentSet] }));
```

### Tabs

AdminPage renders three sub-tabs in a glass pill container: **Elections**, **Voters**, **Admins**.

### Elections tab — `ElectionsTab`

State: `showCreate` (bool), `name`/`desc` (strings), `addCandFor` (electionId | null), `cName`/`cDesc`/`cImg` (strings).

Actions (each with own `loading` bool + inline async handler):

| Action | Contract call | Optimistic update |
|---|---|---|
| Create election | `election.createElection(name, desc)` | Append `{ id: elections.length + 1, name, state:'NotStarted', ... }` (IDs are sequential from 1) |
| Add candidate | `election.addCandidate(id, name, desc, img)` | Append candidate to election's list |
| Start election | `election.startElection(id)` | Set state to `'Open'` |
| End election | `election.endElection(id)` | Set state to `'Ended'` |

Election row card shows: name, state badge, candidate count, action buttons gated by state. "Open polls" disabled when `candidateCount < 2`.

### Voters tab — `VotersTab`

State: `pickedElection` (id), `single` (address string), `batch` (textarea string).

Actions:

| Action | Contract call | Optimistic update |
|---|---|---|
| Authorise single | `voterRegistry.authorizeVoter(electionId, addr)` | Append addr to `voters[electionId]` |
| Revoke | `voterRegistry.revokeVoter(electionId, addr)` | Remove addr from `voters[electionId]` |
| Batch authorise | `voterRegistry.authorizeVoters(electionId, addrs[])` | Append all valid addrs |

Batch parse: split textarea on whitespace/commas, filter lines starting with `0x`.

Voter table: address (mono, truncated), "Authorised" badge, Revoke button per row.

### Admins tab — `AdminsTab`

State: `addr` (string for grant input).

Info notice: "Grant/revoke fires **two** transactions — one on VoterRegistry, one on Election."

Actions:

| Action | Contract calls | Optimistic update |
|---|---|---|
| Grant | `voterRegistry.grantRole(ADMIN_ROLE, addr)` then `election.grantRole(ADMIN_ROLE, addr)` | Append to admins list |
| Revoke | `voterRegistry.revokeRole(ADMIN_ROLE, addr)` then `election.revokeRole(ADMIN_ROLE, addr)` | Remove from admins list |

For grant/revoke: fire the two transactions sequentially (await each `.wait()`). Revoke button disabled when only 1 admin remains.

---

## Error reference

| Error scenario | Handling |
|---|---|
| MetaMask not installed | ConnectButton shows inline "MetaMask not found" message |
| User rejects tx | `e.code === 4001` → toast "Transaction rejected" (error) |
| Contract revert | `e.reason` → toast with revert reason |
| Unknown chainId | `useContract` logs + leaves contracts null; AdminPage shows "wrong network" |
| Not admin | AdminPage guards with `if (!isAdmin) return <NotAuthorized />` |

---

## New files

| File | Purpose |
|---|---|
| `src/lib/utils.js` | `shortAddr(addr, n, m)` helper |
| `src/components/Toasts.jsx` | Toast overlay UI |
| `src/components/PendingTxRibbon.jsx` | Pending tx ribbon UI |

---

## Commit structure

```
feat(frontend): implement wallet.js and useWallet hook (Dev A)
feat(frontend): implement useContract hook (Dev A)
feat(frontend): apply web3 design system to index.css and index.html (Dev A)
feat(frontend): implement Layout and ConnectButton (Dev A)
feat(frontend): wire App.jsx toast and pendingTx state (Dev A)
feat(frontend): implement AdminPage with Elections, Voters, Admins tabs (Dev A)
```
