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
