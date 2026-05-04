# Dev A Phase 2 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill every `TODO(Dev A)` in the frontend scaffold — `wallet.js`, `useWallet.js`, `useContract.js`, `Layout.jsx`, `ConnectButton.jsx`, `App.jsx`, and `AdminPage.jsx` — and apply the web3-native dark design system so Dev B can build `VotePage` and `ResultsPage` on top immediately.

**Architecture:** Pure MetaMask helpers in `wallet.js` → React state in `useWallet` → ethers.Contract instances in `useContract` → Topbar shell in `Layout` → three-tab admin dashboard in `AdminPage`. Toast + pending-tx ribbon state lives in `App.jsx` and is passed to `AdminPage` as props. AdminPage loads data from chain on mount and updates local state optimistically after each confirmed transaction.

**Tech Stack:** React 18, Vite 5, Ethers.js v6, React Router v6, plain CSS (CSS custom properties), MetaMask browser extension.

---

## File map

| Action | Path |
|--------|------|
| Modify | `frontend/index.html` |
| Replace | `frontend/src/index.css` |
| Modify | `frontend/src/App.jsx` |
| Modify | `frontend/src/lib/wallet.js` |
| Modify | `frontend/src/hooks/useWallet.js` |
| Modify | `frontend/src/hooks/useContract.js` |
| Modify | `frontend/src/components/Layout.jsx` |
| Modify | `frontend/src/components/ConnectButton.jsx` |
| Replace | `frontend/src/pages/AdminPage.jsx` |
| Create | `frontend/src/lib/utils.js` |
| Create | `frontend/src/components/Toasts.jsx` |
| Create | `frontend/src/components/PendingTxRibbon.jsx` |

Dev B's files (`ElectionSelector.jsx`, `CandidateCard.jsx`, `AddressBadge.jsx`, `VotePage.jsx`, `ResultsPage.jsx`) are **read-only** for this plan.

---

## Task 1 — `wallet.js` + `useWallet.js`

**Files:**
- Modify: `frontend/src/lib/wallet.js`
- Modify: `frontend/src/hooks/useWallet.js`

- [ ] **Step 1: Implement `wallet.js`**

Replace the entire file:

```js
// Low-level MetaMask helpers. No React here — pure functions.
import { BrowserProvider } from 'ethers';

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
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (err) {
    if (err.code === 4902) throw err; // chain not added — caller handles
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

- [ ] **Step 2: Implement `useWallet.js`**

Replace the entire file:

```js
import { useCallback, useEffect, useState } from 'react';
import * as wallet from '../lib/wallet.js';

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);

  const refresh = useCallback(async () => {
    const signer = await wallet.getSigner();
    if (!signer) {
      setAddress(null);
      setChainId(null);
      return;
    }
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

  return {
    address,
    chainId,
    isConnected: !!address,
    connect,
    disconnect,
  };
}
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Open browser DevTools → Console. No red errors should appear on load.

If MetaMask is installed and already connected, the console should show no errors. If not installed, the app still loads (no crash) because `getSigner()` returns `null` gracefully.

Expected: App loads, no runtime errors in console, no "TODO: implement" errors thrown on page load (those only trigger on button click, which we'll fix in Task 4).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/wallet.js frontend/src/hooks/useWallet.js
git commit -m "feat(frontend): implement wallet.js and useWallet hook (Dev A)"
```

---

## Task 2 — `useContract.js`

**Files:**
- Modify: `frontend/src/hooks/useContract.js`

**Prerequisite — ABI files must exist before this task.**

Run from project root:
```bash
cd contracts && forge build && cd ..
bash scripts/sync-abi.sh
```

Expected output:
```
Syncing ABIs…
  VoterRegistry → frontend/src/contracts/VoterRegistry.json
  Election → frontend/src/contracts/Election.json
Done.
```

If you also have a local anvil deployment, add address sync:
```bash
bash scripts/sync-abi.sh --chain 31337
```

- [ ] **Step 1: Implement `useContract.js`**

Replace the entire file:

```js
import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './useWallet.js';
import addresses from '../contracts/addresses.json';
import voterRegistryAbi from '../contracts/VoterRegistry.json';
import electionAbi from '../contracts/Election.json';
import * as wallet from '../lib/wallet.js';

export function useContract() {
  const { address, chainId, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [contracts, setContracts] = useState({ voterRegistry: null, election: null });

  useEffect(() => {
    if (!isConnected) {
      setContracts({ voterRegistry: null, election: null });
      setIsAdmin(false);
      return;
    }

    async function init() {
      const chainKey = String(chainId);
      const addrs = addresses[chainKey];
      if (!addrs) {
        console.warn('useContract: unsupported chainId', chainId);
        setContracts({ voterRegistry: null, election: null });
        setIsAdmin(false);
        return;
      }
      const signer = await wallet.getSigner();
      if (!signer) return;

      const vr = new Contract(addrs.voterRegistry, voterRegistryAbi.abi, signer);
      const el = new Contract(addrs.election, electionAbi.abi, signer);
      setContracts({ voterRegistry: vr, election: el });

      try {
        const admin = await vr.isAdmin(address);
        setIsAdmin(admin);
      } catch {
        setIsAdmin(false);
      }
    }

    init();
  }, [address, chainId, isConnected]);

  return {
    voterRegistry: contracts.voterRegistry,
    election:      contracts.election,
    isAdmin,
    ready: !!(contracts.voterRegistry && contracts.election),
  };
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Open DevTools → Console.

Connect MetaMask to the app (click connect button — it will still use the old ConnectButton skeleton, that's OK). After connecting:
- If connected to chain 31337 with contracts deployed: no console errors, `ready` is `true` (check by adding a temporary `console.log` in useContract if needed).
- If on an unsupported chain: console warning `useContract: unsupported chainId X` — this is correct behavior.

Expected: No crashes. Warning message on unsupported chain is acceptable.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useContract.js
git commit -m "feat(frontend): implement useContract hook (Dev A)"
```

---

## Task 3 — Design system (`index.html` + `index.css`)

**Files:**
- Modify: `frontend/index.html`
- Replace: `frontend/src/index.css`

- [ ] **Step 1: Add Google Fonts to `index.html`**

Replace the entire file:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Polis — Voting DApp</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `index.css` with the full design system**

Replace the entire file with the following (≈ 480 lines):

```css
/* ── Reset ──────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Design tokens ───────────────────────────────────────────────────────── */
:root {
  --bg:          #07070a;
  --bg-2:        #0c0c11;
  --paper:       #0f0f15;
  --card:        rgba(255,255,255,.03);
  --card-solid:  #14141c;
  --ink:         #f1efea;
  --ink-2:       #b9b6ad;
  --ink-3:       #6f6c66;
  --ink-4:       #3a3a44;
  --line:        rgba(255,255,255,.06);
  --line-2:      rgba(255,255,255,.12);
  --accent:      #c2ff3d;
  --accent-2:    #7c5cff;
  --accent-3:    #ff5cf2;
  --accent-soft: rgba(194,255,61,.12);
  --good:        #6effb0;
  --bad:         #ff6e7e;
  --warn:        #ffb960;
  --sans:        'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --mono:        'Geist Mono', ui-monospace, Menlo, monospace;
  --r-sm:        6px;
  --r-md:        12px;
  --r-lg:        20px;
  --r-xl:        28px;
}

html[data-theme="light"] {
  --bg:          #f3f3f0;
  --bg-2:        #ebebe7;
  --paper:       #ffffff;
  --card:        rgba(0,0,0,.02);
  --card-solid:  #ffffff;
  --ink:         #07070a;
  --ink-2:       #3a3a44;
  --ink-3:       #76736b;
  --ink-4:       #b8b3a6;
  --line:        rgba(0,0,0,.06);
  --line-2:      rgba(0,0,0,.12);
  --accent:      #4d8b00;
  --accent-soft: rgba(77,139,0,.10);
  --good:        #1d7a45;
  --bad:         #c8332a;
}

/* ── Body & backdrop ─────────────────────────────────────────────────────── */
html, body { height: 100%; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
  background-image:
    radial-gradient(60% 40% at 80% 0%,   rgba(124,92,255,.18),  transparent 70%),
    radial-gradient(40% 30% at 10% 10%,  rgba(194,255,61,.10),  transparent 70%),
    linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%);
  background-attachment: fixed;
}

/* 64 × 64 grid, radially masked */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 64px 64px;
  -webkit-mask-image: radial-gradient(80% 60% at 50% 30%, black, transparent 80%);
  mask-image:         radial-gradient(80% 60% at 50% 30%, black, transparent 80%);
}

#root { position: relative; z-index: 1; }

::selection { background: var(--ink); color: var(--bg); }

/* ── Typography utilities ────────────────────────────────────────────────── */
.mono    { font-family: var(--mono); }
.eyebrow {
  font-size: 11px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .14em;
  color: var(--ink-3); font-family: var(--mono);
}
.mb-8  { margin-bottom:  8px; }
.mb-12 { margin-bottom: 12px; }
.mb-16 { margin-bottom: 16px; }
.mb-24 { margin-bottom: 24px; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
button { font: inherit; color: inherit; cursor: pointer; border: none; background: none; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; height: 40px; padding: 0 18px;
  border-radius: var(--r-md);
  background: var(--card); color: var(--ink);
  border: 1px solid var(--line-2);
  font-weight: 500; font-size: 13px; font-family: var(--sans);
  transition: all .18s ease;
  white-space: nowrap; backdrop-filter: blur(12px);
  cursor: pointer;
}
.btn:hover  { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.22); }
.btn:active { transform: translateY(.5px); }
.btn:disabled { opacity: .3; cursor: not-allowed; pointer-events: none; }

.btn-primary { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.btn-primary:hover { filter: brightness(1.1); }

.btn-accent {
  background: var(--accent); color: #07070a;
  border-color: var(--accent); font-weight: 600;
  box-shadow: 0 0 0 1px rgba(194,255,61,.35), 0 8px 24px rgba(194,255,61,.18);
}
.btn-accent:hover {
  box-shadow: 0 0 0 1px rgba(194,255,61,.5), 0 12px 36px rgba(194,255,61,.32);
}

.btn-ghost { background: transparent; border-color: transparent; color: var(--ink-2); }
.btn-ghost:hover { background: var(--line); color: var(--ink); border-color: transparent; }

.btn-danger { color: var(--bad); border-color: var(--line-2); background: transparent; }
.btn-danger:hover { background: rgba(255,110,126,.12); border-color: var(--bad); }

.btn-sm { height: 32px; padding: 0 12px; font-size: 13px; }
.btn-lg { height: 52px; padding: 0 28px; font-size: 15px; }

/* ── Inputs ──────────────────────────────────────────────────────────────── */
.input, .textarea, .select {
  width: 100%; height: 44px; padding: 0 14px;
  background: var(--card-solid); border: 1px solid var(--line-2);
  border-radius: var(--r-md);
  color: var(--ink); font: inherit; font-size: 13px; font-family: var(--mono);
  outline: none; transition: border-color .15s, box-shadow .15s;
}
.input:focus, .textarea:focus, .select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input::placeholder, .textarea::placeholder { color: var(--ink-3); }
.textarea { height: auto; padding: 12px 14px; resize: vertical; min-height: 100px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field > label {
  font-size: 11px; font-weight: 500; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: .12em; font-family: var(--mono);
}

/* ── Layout shell ────────────────────────────────────────────────────────── */
.shell { min-height: 100vh; display: flex; flex-direction: column; }
.container { max-width: 1280px; margin: 0 auto; padding: 0 32px; width: 100%; }
@media (max-width: 720px) { .container { padding: 0 20px; } }

.page { animation: pageIn .35s cubic-bezier(.2,.8,.2,1); }
@keyframes pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Topbar ──────────────────────────────────────────────────────────────── */
.top {
  position: sticky; top: 0; z-index: 50;
  backdrop-filter: blur(24px) saturate(160%);
  background: color-mix(in oklab, var(--bg) 70%, transparent);
  border-bottom: 1px solid var(--line);
}
.top-inner {
  height: 68px;
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: 20px;
}
@media (max-width: 720px) {
  .top-inner { grid-template-columns: 1fr auto; }
  .top-nav   { display: none; }
}

.brand {
  display: flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-weight: 600; font-size: 14px;
  text-transform: uppercase; letter-spacing: -.01em;
  text-decoration: none; color: var(--ink);
}
.brand-mark {
  width: 24px; height: 24px; border-radius: 6px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  position: relative; box-shadow: 0 0 16px rgba(194,255,61,.4); flex-shrink: 0;
}
.brand-mark::after {
  content: ""; position: absolute; inset: 6px;
  border: 1.5px solid #07070a; border-radius: 50%;
  border-top-color: transparent;
}

.top-nav {
  display: flex; gap: 4px; justify-self: center;
  padding: 4px; background: var(--card);
  border: 1px solid var(--line); border-radius: var(--r-md);
  backdrop-filter: blur(12px);
}
.top-nav a {
  display: inline-flex; align-items: center;
  height: 32px; padding: 0 16px; border-radius: var(--r-sm);
  background: transparent; color: var(--ink-2);
  font-size: 13px; font-weight: 500; font-family: var(--mono);
  transition: background .15s, color .15s;
  text-decoration: none; cursor: pointer;
}
.top-nav a:hover  { color: var(--ink); background: var(--line); }
.top-nav a.active { background: var(--ink); color: var(--bg); }

.top-right { display: flex; align-items: center; gap: 10px; justify-self: end; }

.net-pill {
  display: inline-flex; align-items: center; gap: 8px;
  height: 32px; padding: 0 12px; border-radius: var(--r-sm);
  background: var(--card); border: 1px solid var(--line);
  font-size: 11px; color: var(--ink-2); font-family: var(--mono);
  text-transform: uppercase; letter-spacing: .08em;
}
.net-pill .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--good); box-shadow: 0 0 8px var(--good);
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

.wallet {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px; padding: 0 6px 0 12px; border-radius: var(--r-md);
  background: var(--card); border: 1px solid var(--line-2);
  font-size: 12px; white-space: nowrap; flex-shrink: 0;
  font-family: var(--mono);
}
.wallet .avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  flex-shrink: 0;
}

/* ── State badges ────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  height: 24px; padding: 0 10px; border-radius: 100px;
  font-size: 11px; font-weight: 500; font-family: var(--mono);
  border: 1px solid currentColor; white-space: nowrap;
}
.badge .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.badge-open       { color: var(--accent); background: var(--accent-soft); }
.badge-ended      { color: var(--ink-3);  background: transparent; }
.badge-notstarted { color: var(--ink-4);  background: transparent; }

/* ── Toast overlay ───────────────────────────────────────────────────────── */
.toast-wrap {
  position: fixed; bottom: 24px; right: 24px; z-index: 200;
  display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px; border-radius: var(--r-md);
  background: var(--card-solid); border: 1px solid var(--line-2);
  font-size: 13px; backdrop-filter: blur(16px);
  animation: toastIn .25s cubic-bezier(.2,.8,.2,1);
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
  pointer-events: auto; max-width: 320px;
}
.toast.success { border-left: 3px solid var(--good); }
.toast.error   { border-left: 3px solid var(--bad);  }
@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Pending tx ribbon ───────────────────────────────────────────────────── */
.tx-ribbon {
  position: fixed; top: 68px; left: 0; right: 0; z-index: 49;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 32px;
  background: color-mix(in oklab, var(--bg-2) 90%, transparent);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(12px); font-size: 13px;
}
.tx-ribbon .spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--line-2); border-top-color: var(--accent);
  animation: spin .8s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.tx-ribbon .info .title { font-weight: 500; }
.tx-ribbon .info .hash  { font-family: var(--mono); font-size: 11px; color: var(--ink-3); margin-top: 2px; }

/* ── Admin page ──────────────────────────────────────────────────────────── */
.admin-page { padding: 40px 0 80px; }

.subtabs {
  display: flex; gap: 4px; padding: 4px;
  background: var(--card); border: 1px solid var(--line);
  border-radius: var(--r-md); backdrop-filter: blur(12px);
  margin: 24px 0; width: fit-content;
}
.subtab {
  display: inline-flex; align-items: center; gap: 8px;
  height: 32px; padding: 0 16px; border-radius: var(--r-sm);
  background: transparent; color: var(--ink-2);
  font-size: 13px; font-weight: 500; font-family: var(--mono);
  transition: background .15s, color .15s; cursor: pointer;
}
.subtab:hover  { color: var(--ink); background: var(--line); }
.subtab.active { background: var(--accent); color: #07070a; }
.subtab .num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(0,0,0,.15); font-size: 10px; font-weight: 600;
}

.row-card {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 20px 24px;
  border: 1px solid var(--line-2); border-radius: var(--r-lg);
  background: var(--card); backdrop-filter: blur(12px); flex-wrap: wrap;
}
.row-card .meta      { flex: 1; min-width: 0; }
.row-card .meta .title {
  font-weight: 600; font-size: 15px; letter-spacing: -.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.row-card .meta .sub { font-size: 12px; color: var(--ink-3); font-family: var(--mono); margin-top: 4px; }
.row-card .actions   { display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }

.form-card {
  padding: 24px;
  border: 1px solid var(--line-2); border-radius: var(--r-lg);
  background: var(--card); backdrop-filter: blur(12px);
}

/* Flex helpers */
.col    { display: flex; flex-direction: column; }
.row-h  { display: flex; align-items: center; flex-wrap: wrap; }
.gap-8  { gap: 8px;  }
.gap-12 { gap: 12px; }
.gap-16 { gap: 16px; }
.grow   { flex: 1;   }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
@media (max-width: 900px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
}

/* Table */
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th {
  text-align: left; padding: 12px 16px;
  font-size: 11px; font-weight: 500; text-transform: uppercase;
  letter-spacing: .1em; color: var(--ink-3); font-family: var(--mono);
  border-bottom: 1px solid var(--line);
}
.tbl td { padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.tbl tr:last-child td { border-bottom: none; }
.tbl .empty { padding: 24px 16px; color: var(--ink-3); text-align: center; font-size: 12px; }

/* Info alert */
.alert {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 18px; border-radius: var(--r-md); font-size: 13px;
}
.alert.alert-info {
  background: rgba(124,92,255,.10);
  border: 1px solid rgba(124,92,255,.25);
  color: var(--ink-2);
}
.alert .ico {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent-2); color: white;
  font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* Chips (election picker) */
.chip {
  display: inline-flex; align-items: center; gap: 8px;
  height: 32px; padding: 0 14px; border-radius: 100px;
  border: 1px solid var(--line-2); background: var(--card);
  color: var(--ink-2); font-size: 12px; font-weight: 500; font-family: var(--mono);
  cursor: pointer; transition: all .15s;
}
.chip:hover  { color: var(--ink); background: var(--line); }
.chip.active { background: var(--accent); color: #07070a; border-color: var(--accent); font-weight: 600; }
.chip .count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: 100px;
  background: rgba(0,0,0,.12); font-size: 10px;
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Expected visual checks:

- Background is very dark (`#07070a`) with faint grid lines visible
- Radial violet glow top-right, subtle lime glow top-left
- Body text uses Geist font (not system-ui)
- The old layout header is still visible but unstyled (OK — replaced in Task 4)
- No font-loading errors in DevTools Network tab

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "feat(frontend): apply web3 design system to index.css and index.html (Dev A)"
```

---

## Task 4 — `utils.js` + `Layout.jsx` + `ConnectButton.jsx`

**Files:**
- Create: `frontend/src/lib/utils.js`
- Replace: `frontend/src/components/Layout.jsx`
- Replace: `frontend/src/components/ConnectButton.jsx`

- [ ] **Step 1: Create `src/lib/utils.js`**

```js
export function shortAddr(addr, n = 4, m = 4) {
  if (!addr) return '';
  return addr.slice(0, 2 + n) + '…' + addr.slice(-m);
}
```

- [ ] **Step 2: Replace `Layout.jsx`**

```jsx
import { NavLink, Outlet } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet.js';
import { useContract } from '../hooks/useContract.js';
import ConnectButton from './ConnectButton.jsx';
import { NETWORKS } from '../config/networks.js';

function BrandMark() {
  return (
    <a href="/" className="brand">
      <div className="brand-mark"></div>
      <span>Polis</span>
    </a>
  );
}

function NetworkPill({ chainId }) {
  const name = NETWORKS[chainId]?.name ?? `Chain ${chainId}`;
  return (
    <span className="net-pill">
      <span className="dot"></span>
      {name}
    </span>
  );
}

export default function Layout() {
  const { chainId } = useWallet();
  const { isAdmin } = useContract();

  return (
    <div className="shell">
      <header className="top">
        <div className="top-inner container">
          <BrandMark />
          <nav className="top-nav">
            <NavLink to="/vote"    className={({ isActive }) => isActive ? 'active' : ''}>Vote</NavLink>
            <NavLink to="/results" className={({ isActive }) => isActive ? 'active' : ''}>Results</NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>Admin</NavLink>
            )}
          </nav>
          <div className="top-right">
            {chainId && <NetworkPill chainId={chainId} />}
            <ConnectButton />
          </div>
        </div>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Replace `ConnectButton.jsx`**

```jsx
import { useState } from 'react';
import { useWallet } from '../hooks/useWallet.js';
import { shortAddr } from '../lib/utils.js';

export default function ConnectButton() {
  const { address, isConnected, connect } = useWallet();
  const [error, setError] = useState(null);

  async function handleConnect() {
    setError(null);
    try {
      await connect();
    } catch {
      setError('MetaMask not found or rejected');
    }
  }

  if (isConnected) {
    return (
      <span className="wallet">
        <span className="mono">{shortAddr(address, 4, 4)}</span>
        <span className="avatar"></span>
      </span>
    );
  }

  return (
    <div>
      <button className="btn btn-primary btn-sm" onClick={handleConnect}>
        Connect
      </button>
      {error && (
        <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4, textAlign: 'right' }}>
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Expected:

1. Topbar renders with:
   - Left: gradient brand mark + "POLIS" text
   - Center: pill nav with "Vote" and "Results" tabs (no "Admin" yet — only appears after connecting as admin)
   - Right: "Connect" button (glass style, dark bg)
2. Clicking "Connect" triggers MetaMask connection prompt
3. After connecting: wallet pill shows `0x1234…5678` + colored avatar circle
4. Network pill shows "ANVIL (LOCAL)" or "SEPOLIA" with pulsing green dot
5. If MetaMask is not installed: "MetaMask not found or rejected" appears in red below the button
6. After connecting as an admin wallet: "Admin" tab appears in the nav

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/utils.js frontend/src/components/Layout.jsx frontend/src/components/ConnectButton.jsx
git commit -m "feat(frontend): implement Layout and ConnectButton (Dev A)"
```

---

## Task 5 — `App.jsx` + `Toasts.jsx` + `PendingTxRibbon.jsx`

**Files:**
- Replace: `frontend/src/App.jsx`
- Create: `frontend/src/components/Toasts.jsx`
- Create: `frontend/src/components/PendingTxRibbon.jsx`

- [ ] **Step 1: Create `Toasts.jsx`**

```jsx
export default function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind ?? ''}`}>
          {t.kind === 'success' && <span>✓</span>}
          {t.kind === 'error'   && <span>!</span>}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `PendingTxRibbon.jsx`**

```jsx
export default function PendingTxRibbon({ tx }) {
  if (!tx) return null;
  return (
    <div className="tx-ribbon">
      <span className="spinner"></span>
      <div className="info">
        <div className="title">{tx.label}</div>
        {tx.hash && (
          <div className="hash">
            tx {tx.hash.slice(0, 10)}&hellip;{tx.hash.slice(-6)}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `App.jsx`**

```jsx
import { useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout          from './components/Layout.jsx';
import AdminPage       from './pages/AdminPage.jsx';
import VotePage        from './pages/VotePage.jsx';
import ResultsPage     from './pages/ResultsPage.jsx';
import Toasts          from './components/Toasts.jsx';
import PendingTxRibbon from './components/PendingTxRibbon.jsx';

export default function App() {
  const [toasts, setToasts]     = useState([]);
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
          <Route path="admin"
            element={<AdminPage pushToast={pushToast} setPendingTx={setPendingTx} />}
          />
          <Route path="vote"    element={<VotePage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="*"       element={<Navigate to="/vote" replace />} />
        </Route>
      </Routes>
      <Toasts toasts={toasts} />
      <PendingTxRibbon tx={pendingTx} />
    </>
  );
}
```

- [ ] **Step 4: Verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Open DevTools Console.

Paste this in the console to manually trigger a toast:

```js
// This won't work directly because pushToast is not global,
// but you can verify by navigating to /admin (which requires wallet connect + admin role).
// Instead, verify the toast CSS exists:
document.querySelector('.toast-wrap')
// Expected: null (no toasts yet) — but the DOM node exists in the style rules
```

Simpler verification: confirm no runtime errors on page load or navigation. The app should route correctly:
- `/` → redirect to `/vote`
- `/vote` → VotePage skeleton renders
- `/results` → ResultsPage skeleton renders
- `/admin` → AdminPage renders (shows "Connect a wallet" if not connected)
- Unknown URL → redirect to `/vote`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Toasts.jsx frontend/src/components/PendingTxRibbon.jsx
git commit -m "feat(frontend): wire App.jsx toast and pendingTx state (Dev A)"
```

---

## Task 6 — `AdminPage.jsx`

**Files:**
- Replace: `frontend/src/pages/AdminPage.jsx`

This is the largest task. The file is split into four sections written in order:
1. Imports + helpers
2. `AdminPage` root component (data loading, tab routing)
3. `ElectionsTab` component
4. `VotersTab` component
5. `AdminsTab` component

- [ ] **Step 1: Write the imports + helper block**

```jsx
import { useEffect, useRef, useState } from 'react';
import { useContract } from '../hooks/useContract.js';

const STATE_LABELS = ['NotStarted', 'Open', 'Ended'];
function stateLabel(s) { return STATE_LABELS[Number(s)] ?? 'NotStarted'; }

function StateBadge({ state }) {
  const cls =
    state === 'Open'   ? 'badge-open' :
    state === 'Ended'  ? 'badge-ended' : 'badge-notstarted';
  return (
    <span className={`badge ${cls}`}>
      <span className="dot"></span>
      {state === 'NotStarted' ? 'Not started' : state}
    </span>
  );
}
```

- [ ] **Step 2: Write the `AdminPage` root component (data loading + tab routing)**

Append below the helpers:

```jsx
export default function AdminPage({ pushToast, setPendingTx }) {
  const { voterRegistry, election, isAdmin, ready } = useContract();
  const [tab, setTab]           = useState('elections');
  const [elections, setElections] = useState([]);
  const [admins, setAdmins]       = useState([]);
  const [voters, setVoters]       = useState({});   // { [electionId]: string[] }
  const [loading, setLoading]     = useState(true);
  const adminRoleRef = useRef(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([loadElections(), loadAdmins()]).finally(() => setLoading(false));
  }, [ready]);

  async function loadElections() {
    const count = Number(await election.electionCount());
    if (count === 0) { setElections([]); return; }
    const list = await Promise.all(
      Array.from({ length: count }, (_, i) => election.getElection(i + 1))
    );
    setElections(list.map(e => ({
      id:             Number(e.id),
      name:           e.name,
      description:    e.description,
      creator:        e.creator,
      state:          stateLabel(e.state),
      candidateCount: Number(e.candidateCount),
    })));
  }

  async function loadAdmins() {
    const ADMIN_ROLE = await voterRegistry.ADMIN_ROLE();
    adminRoleRef.current = ADMIN_ROLE;

    const [vrGranted, vrRevoked, elGranted, elRevoked] = await Promise.all([
      voterRegistry.queryFilter(voterRegistry.filters.RoleGranted(ADMIN_ROLE), 0),
      voterRegistry.queryFilter(voterRegistry.filters.RoleRevoked(ADMIN_ROLE), 0),
      election.queryFilter(election.filters.RoleGranted(ADMIN_ROLE), 0),
      election.queryFilter(election.filters.RoleRevoked(ADMIN_ROLE), 0),
    ]);

    function buildSet(granted, revoked) {
      const s = new Set(granted.map(l => l.args[1].toLowerCase()));
      revoked.forEach(l => s.delete(l.args[1].toLowerCase()));
      return s;
    }
    const vrSet = buildSet(vrGranted, vrRevoked);
    const elSet = buildSet(elGranted, elRevoked);
    const both  = [...vrSet].filter(a => elSet.has(a));

    setAdmins(both.map(addr => ({ addr, grantedAt: '—', grantedBy: '—' })));
  }

  async function loadVoters(electionId) {
    const eid = BigInt(electionId);
    const [authorized, revoked] = await Promise.all([
      voterRegistry.queryFilter(voterRegistry.filters.VoterAuthorized(eid), 0),
      voterRegistry.queryFilter(voterRegistry.filters.VoterRevoked(eid), 0),
    ]);
    const s = new Set(authorized.map(l => l.args[1].toLowerCase()));
    revoked.forEach(l => s.delete(l.args[1].toLowerCase()));
    setVoters(prev => ({ ...prev, [electionId]: [...s] }));
  }

  if (!ready)   return <NotReady msg="Connect a wallet to continue." />;
  if (!isAdmin) return <NotReady msg="Your account does not hold ADMIN_ROLE." />;
  if (loading)  return <NotReady msg="Loading…" />;

  return (
    <div className="page">
      <div className="container admin-page">
        <div className="eyebrow mb-16">Admin</div>
        <h1 style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-.02em', marginBottom: 0 }}>
          <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Admin</em>
        </h1>

        <div className="subtabs">
          <button className={`subtab${tab === 'elections' ? ' active' : ''}`}
            onClick={() => setTab('elections')}>
            Elections <span className="num">{elections.length}</span>
          </button>
          <button className={`subtab${tab === 'voters' ? ' active' : ''}`}
            onClick={() => setTab('voters')}>
            Voters
          </button>
          <button className={`subtab${tab === 'admins' ? ' active' : ''}`}
            onClick={() => setTab('admins')}>
            Admins <span className="num">{admins.length}</span>
          </button>
        </div>

        {tab === 'elections' && (
          <ElectionsTab
            elections={elections} setElections={setElections}
            election={election}
            pushToast={pushToast} setPendingTx={setPendingTx}
          />
        )}
        {tab === 'voters' && (
          <VotersTab
            elections={elections}
            voters={voters} setVoters={setVoters}
            voterRegistry={voterRegistry}
            loadVoters={loadVoters}
            pushToast={pushToast} setPendingTx={setPendingTx}
          />
        )}
        {tab === 'admins' && (
          <AdminsTab
            admins={admins} setAdmins={setAdmins}
            voterRegistry={voterRegistry} election={election}
            adminRoleRef={adminRoleRef}
            pushToast={pushToast} setPendingTx={setPendingTx}
          />
        )}
      </div>
    </div>
  );
}

function NotReady({ msg }) {
  return (
    <div className="page">
      <div className="container admin-page">
        <p style={{ color: 'var(--ink-3)' }}>{msg}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `ElectionsTab`**

Append below `NotReady`:

```jsx
function ElectionsTab({ elections, setElections, election, pushToast, setPendingTx }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName]             = useState('');
  const [desc, setDesc]             = useState('');
  const [creating, setCreating]     = useState(false);
  const [addCandFor, setAddCandFor] = useState(null);  // electionId | null
  const [cName, setCName]           = useState('');
  const [cDesc, setCDesc]           = useState('');
  const [cImg, setCImg]             = useState('');
  const [addingCand, setAddingCand] = useState(false);
  const [starting, setStarting]     = useState(null);  // electionId | null
  const [ending, setEnding]         = useState(null);   // electionId | null

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const tx = await election.createElection(name.trim(), desc.trim());
      setPendingTx({ label: `Creating "${name.trim()}"…`, hash: tx.hash });
      await tx.wait();
      setElections(prev => [...prev, {
        id: prev.length + 1,
        name: name.trim(), description: desc.trim(),
        state: 'NotStarted', candidateCount: 0,
      }]);
      pushToast('Election created', 'success');
      setName(''); setDesc(''); setShowCreate(false);
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setCreating(false); setPendingTx(null); }
  }

  async function handleAddCandidate(electionId) {
    if (!cName.trim()) return;
    setAddingCand(true);
    try {
      const tx = await election.addCandidate(electionId, cName.trim(), cDesc.trim(), cImg.trim());
      setPendingTx({ label: `Adding "${cName.trim()}"…`, hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e =>
        e.id === electionId ? { ...e, candidateCount: e.candidateCount + 1 } : e
      ));
      pushToast('Candidate added', 'success');
      setCName(''); setCDesc(''); setCImg(''); setAddCandFor(null);
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setAddingCand(false); setPendingTx(null); }
  }

  async function handleStart(electionId) {
    setStarting(electionId);
    try {
      const tx = await election.startElection(electionId);
      setPendingTx({ label: 'Opening polls…', hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e => e.id === electionId ? { ...e, state: 'Open' } : e));
      pushToast('Election opened', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setStarting(null); setPendingTx(null); }
  }

  async function handleEnd(electionId) {
    setEnding(electionId);
    try {
      const tx = await election.endElection(electionId);
      setPendingTx({ label: 'Closing election…', hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e => e.id === electionId ? { ...e, state: 'Ended' } : e));
      pushToast('Election ended', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setEnding(null); setPendingTx(null); }
  }

  return (
    <>
      <div className="row-h gap-12" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="eyebrow">All ballots</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(s => !s)}>
          {showCreate ? 'Cancel' : '+ New election'}
        </button>
      </div>

      {showCreate && (
        <div className="form-card mb-24">
          <div className="grid-2">
            <div className="field">
              <label>Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Election name" />
            </div>
            <div className="field">
              <label>Description</label>
              <input className="input" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Short description" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-accent" onClick={handleCreate}
              disabled={!name.trim() || creating}>
              {creating ? 'Creating…' : 'Create election'}
            </button>
          </div>
        </div>
      )}

      <div className="col gap-16">
        {elections.length === 0 && (
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No elections yet.</p>
        )}
        {elections.map(e => (
          <div key={e.id}>
            <div className="row-card">
              <div className="meta">
                <div className="row-h gap-12" style={{ flexWrap: 'wrap' }}>
                  <span className="title">{e.name}</span>
                  <StateBadge state={e.state} />
                </div>
                <div className="sub">
                  #{String(e.id).padStart(3, '0')} &middot; {e.candidateCount} candidate{e.candidateCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="actions">
                {e.state === 'NotStarted' && (<>
                  <button className="btn btn-sm"
                    onClick={() => setAddCandFor(addCandFor === e.id ? null : e.id)}>
                    + Candidate
                  </button>
                  <button className="btn btn-sm btn-primary"
                    disabled={e.candidateCount < 2 || starting === e.id}
                    onClick={() => handleStart(e.id)}>
                    {starting === e.id ? 'Opening…' : 'Open polls'}
                  </button>
                </>)}
                {e.state === 'Open' && (
                  <button className="btn btn-sm btn-danger"
                    disabled={ending === e.id}
                    onClick={() => handleEnd(e.id)}>
                    {ending === e.id ? 'Closing…' : 'End election'}
                  </button>
                )}
                {e.state === 'Ended' && <StateBadge state="Ended" />}
              </div>
            </div>

            {addCandFor === e.id && (
              <div className="form-card" style={{ marginTop: 8 }}>
                <div className="grid-3">
                  <div className="field">
                    <label>Name</label>
                    <input className="input" value={cName} onChange={ev => setCName(ev.target.value)}
                      placeholder="Full name" />
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <input className="input" value={cDesc} onChange={ev => setCDesc(ev.target.value)}
                      placeholder="One-line platform" />
                  </div>
                  <div className="field">
                    <label>Image URL</label>
                    <input className="input" value={cImg} onChange={ev => setCImg(ev.target.value)}
                      placeholder="https://…" />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm" onClick={() => setAddCandFor(null)}>Cancel</button>
                  <button className="btn btn-sm btn-accent"
                    disabled={!cName.trim() || addingCand}
                    onClick={() => handleAddCandidate(e.id)}>
                    {addingCand ? 'Adding…' : 'Add candidate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Write `VotersTab`**

Append below `ElectionsTab`:

```jsx
function VotersTab({ elections, voters, setVoters, voterRegistry, loadVoters, pushToast, setPendingTx }) {
  const [pickedId, setPickedId]           = useState(elections[0]?.id ?? null);
  const [single, setSingle]               = useState('');
  const [batch, setBatch]                 = useState('');
  const [authorizing, setAuthorizing]     = useState(false);
  const [revoking, setRevoking]           = useState(null);   // addr | null
  const [batchAuth, setBatchAuth]         = useState(false);

  useEffect(() => {
    if (pickedId !== null && !voters[pickedId]) loadVoters(pickedId);
  }, [pickedId]);

  const list = voters[pickedId] ?? [];

  async function handleAuthorize() {
    if (!single.startsWith('0x') || pickedId === null) return;
    setAuthorizing(true);
    try {
      const tx = await voterRegistry.authorizeVoter(pickedId, single);
      setPendingTx({ label: `Authorising ${single.slice(0, 10)}…`, hash: tx.hash });
      await tx.wait();
      setVoters(prev => ({ ...prev, [pickedId]: [...(prev[pickedId] ?? []), single.toLowerCase()] }));
      pushToast('Voter authorised', 'success');
      setSingle('');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setAuthorizing(false); setPendingTx(null); }
  }

  async function handleRevoke(addr) {
    if (pickedId === null) return;
    setRevoking(addr);
    try {
      const tx = await voterRegistry.revokeVoter(pickedId, addr);
      setPendingTx({ label: `Revoking ${addr.slice(0, 10)}…`, hash: tx.hash });
      await tx.wait();
      setVoters(prev => ({
        ...prev,
        [pickedId]: (prev[pickedId] ?? []).filter(a => a !== addr.toLowerCase()),
      }));
      pushToast('Voter revoked', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setRevoking(null); setPendingTx(null); }
  }

  async function handleBatchAuthorize() {
    if (pickedId === null) return;
    const addrs = batch.split(/[\s,]+/).filter(a => a.startsWith('0x') && a.length >= 10);
    if (!addrs.length) return;
    setBatchAuth(true);
    try {
      const tx = await voterRegistry.authorizeVoters(pickedId, addrs);
      setPendingTx({ label: `Authorising ${addrs.length} voters…`, hash: tx.hash });
      await tx.wait();
      setVoters(prev => ({
        ...prev,
        [pickedId]: [...new Set([...(prev[pickedId] ?? []), ...addrs.map(a => a.toLowerCase())])],
      }));
      pushToast(`${addrs.length} voters authorised`, 'success');
      setBatch('');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setBatchAuth(false); setPendingTx(null); }
  }

  return (
    <>
      <div className="eyebrow mb-16">Per-election authorisation</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {elections.map(e => (
          <button key={e.id}
            className={`chip${e.id === pickedId ? ' active' : ''}`}
            style={{ height: 40, padding: '0 18px' }}
            onClick={() => setPickedId(e.id)}>
            {e.name.length > 36 ? e.name.slice(0, 34) + '…' : e.name}
            <span className="count">{(voters[e.id] ?? []).length}</span>
          </button>
        ))}
        {elections.length === 0 && (
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>No elections yet.</p>
        )}
      </div>

      {pickedId !== null && (
        <>
          <div className="grid-2 mb-24">
            <div className="form-card">
              <div className="eyebrow mb-16">Authorise single</div>
              <div className="field">
                <label>Address</label>
                <input className="input" value={single}
                  onChange={e => setSingle(e.target.value)} placeholder="0x…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-sm btn-accent"
                  disabled={!single.startsWith('0x') || authorizing}
                  onClick={handleAuthorize}>
                  {authorizing ? 'Authorising…' : 'Authorise'}
                </button>
              </div>
            </div>

            <div className="form-card">
              <div className="eyebrow mb-16">Batch authorise</div>
              <div className="field">
                <label>Comma- or newline-separated</label>
                <textarea className="textarea" value={batch}
                  onChange={e => setBatch(e.target.value)}
                  placeholder={'0x1A2b…\n0x2B3c…'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-sm btn-accent"
                  disabled={!batch.trim() || batchAuth}
                  onClick={handleBatchAuthorize}>
                  {batchAuth ? 'Authorising…' : 'Authorise batch'}
                </button>
              </div>
            </div>
          </div>

          <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{list.length} voters</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Address</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((addr, i) => (
                  <tr key={addr}>
                    <td style={{ color: 'var(--ink-3)' }}>{i + 1}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{addr}</td>
                    <td>
                      <span className="badge badge-open">
                        <span className="dot"></span>Authorised
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-danger"
                        disabled={revoking === addr}
                        onClick={() => handleRevoke(addr)}>
                        {revoking === addr ? 'Revoking…' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={4} className="empty">No voters authorised yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Write `AdminsTab`**

Append below `VotersTab`:

```jsx
function AdminsTab({ admins, setAdmins, voterRegistry, election, adminRoleRef, pushToast, setPendingTx }) {
  const [addr, setAddr]         = useState('');
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(null);  // addr | null

  async function handleGrant() {
    const ADMIN_ROLE = adminRoleRef.current;
    if (!addr.startsWith('0x') || !ADMIN_ROLE || granting) return;
    setGranting(true);
    try {
      const tx1 = await voterRegistry.grantRole(ADMIN_ROLE, addr);
      setPendingTx({ label: 'Granting on VoterRegistry…', hash: tx1.hash });
      await tx1.wait();
      const tx2 = await election.grantRole(ADMIN_ROLE, addr);
      setPendingTx({ label: 'Granting on Election…', hash: tx2.hash });
      await tx2.wait();
      setAdmins(prev => [...prev, { addr: addr.toLowerCase(), grantedAt: '—', grantedBy: '—' }]);
      pushToast('Admin role granted on both contracts', 'success');
      setAddr('');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setGranting(false); setPendingTx(null); }
  }

  async function handleRevoke(target) {
    const ADMIN_ROLE = adminRoleRef.current;
    if (!ADMIN_ROLE) return;
    setRevoking(target);
    try {
      const tx1 = await voterRegistry.revokeRole(ADMIN_ROLE, target);
      setPendingTx({ label: 'Revoking on VoterRegistry…', hash: tx1.hash });
      await tx1.wait();
      const tx2 = await election.revokeRole(ADMIN_ROLE, target);
      setPendingTx({ label: 'Revoking on Election…', hash: tx2.hash });
      await tx2.wait();
      setAdmins(prev => prev.filter(a => a.addr !== target.toLowerCase()));
      pushToast('Admin role revoked on both contracts', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setRevoking(null); setPendingTx(null); }
  }

  return (
    <>
      <div className="alert alert-info mb-24">
        <span className="ico">i</span>
        <span>
          Grant/revoke fires <strong>two</strong> transactions &mdash; one on VoterRegistry, one on Election.
        </span>
      </div>

      <div className="form-card mb-24">
        <div className="row-h gap-12" style={{ alignItems: 'flex-end' }}>
          <div className="field grow">
            <label>Grant ADMIN_ROLE to</label>
            <input className="input" value={addr}
              onChange={e => setAddr(e.target.value)} placeholder="0x…" />
          </div>
          <button className="btn btn-accent"
            disabled={!addr.startsWith('0x') || granting}
            onClick={handleGrant}>
            {granting ? 'Granting…' : 'Grant'}
          </button>
        </div>
      </div>

      <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>Admins</div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Address</th><th>Granted</th><th>By</th><th></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a, i) => (
              <tr key={a.addr}>
                <td style={{ color: 'var(--ink-3)' }}>{i + 1}</td>
                <td className="mono" style={{ fontSize: 12 }}>{a.addr}</td>
                <td className="mono">{a.grantedAt}</td>
                <td className="mono">{a.grantedBy}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm btn-danger"
                    disabled={admins.length <= 1 || revoking === a.addr}
                    onClick={() => handleRevoke(a.addr)}>
                    {revoking === a.addr ? 'Revoking…' : 'Revoke'}
                  </button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={5} className="empty">No admins loaded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Verify all three tabs in browser**

Prerequisites: anvil running, contracts deployed, ABIs synced, `addresses.json` updated, admin wallet connected.

```bash
# Terminal 1 — start anvil
cd contracts && anvil

# Terminal 2 — deploy contracts
cd contracts && forge script script/Deploy.s.sol --broadcast --rpc-url http://127.0.0.1:8545 --private-key <PRIVATE_KEY>

# Terminal 3 — sync ABIs and addresses
bash scripts/sync-abi.sh --chain 31337

# Terminal 4 — start dev server
cd frontend && npm run dev
```

Open `http://localhost:5173`. Connect MetaMask to Anvil (chain 31337). Connect the deployer wallet (which has ADMIN_ROLE).

**Elections tab checks:**
- [ ] "No elections yet" shows initially
- [ ] Click "+ New election" → create form appears with Name + Description fields
- [ ] Fill form → click "Create election" → MetaMask pops up
- [ ] Confirm in MetaMask → pending ribbon shows "Creating…" → toast "Election created" appears
- [ ] New election row appears with "Not started" badge, "0 candidates"
- [ ] "Open polls" button is disabled (0 < 2 candidates)
- [ ] Click "+ Candidate" → inline form appears → add 2 candidates
- [ ] "Open polls" becomes enabled → click it → MetaMask → confirms → badge changes to "Open"
- [ ] "End election" → MetaMask → confirms → badge changes to "Ended"

**Voters tab checks:**
- [ ] Election chips appear; selecting one loads voter list (initially empty)
- [ ] Enter an address in "Authorise single" → click "Authorise" → MetaMask → confirms → address appears in table
- [ ] Paste two addresses in batch textarea → "Authorise batch" → confirms → both appear
- [ ] Click "Revoke" on a voter → MetaMask → confirms → voter removed from table

**Admins tab checks:**
- [ ] Info notice about two transactions is visible
- [ ] Current admin list shows deployer address
- [ ] Enter a new address → click "Grant" → TWO MetaMask prompts (one per contract) → address added to list
- [ ] "Revoke" disabled when only 1 admin remains

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/AdminPage.jsx
git commit -m "feat(frontend): implement AdminPage with Elections, Voters, Admins tabs (Dev A)"
```

---

## Self-review checklist (for agentic workers)

After completing all 6 tasks, verify:

- [ ] `npm run dev` starts with zero console errors on a fresh page load (no wallet connected)
- [ ] Connecting MetaMask shows wallet pill in topbar with truncated address
- [ ] Navigating `/vote` and `/results` works (Dev B's skeleton pages still render, no crash)
- [ ] Navigating `/admin` without wallet shows "Connect a wallet to continue"
- [ ] Navigating `/admin` with non-admin wallet shows "Your account does not hold ADMIN_ROLE"
- [ ] All 6 commits exist with exact messages from the plan
- [ ] `git diff main -- frontend/src/pages/VotePage.jsx` shows no changes (Dev B's files untouched)
