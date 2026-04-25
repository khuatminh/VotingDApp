// Renders "Connect Wallet" or a short address badge when connected.
import { useWallet } from '../hooks/useWallet.js';
import AddressBadge from './AddressBadge.jsx';

export default function ConnectButton() {
  const { address, isConnected, connect } = useWallet();

  if (isConnected) {
    return <AddressBadge address={address} />;
  }
  return (
    <button type="button" onClick={connect} className="btn btn--primary">
      Connect Wallet
    </button>
  );
  // TODO(Dev A): surface errors from connect() via a toast or inline message.
}
