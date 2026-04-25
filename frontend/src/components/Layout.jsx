// Shared layout: top nav (Admin / Vote / Results) + ConnectButton + content outlet.
import { NavLink, Outlet } from 'react-router-dom';
import ConnectButton from './ConnectButton.jsx';

export default function Layout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <h1 className="layout__title">Voting DApp</h1>
        <nav className="layout__nav">
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/vote">Vote</NavLink>
          <NavLink to="/results">Results</NavLink>
        </nav>
        <ConnectButton />
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}
