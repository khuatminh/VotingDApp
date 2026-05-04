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
