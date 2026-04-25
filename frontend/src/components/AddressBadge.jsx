// Tiny display for a truncated address: 0xabcd...1234.
// Props: { address: string }

export default function AddressBadge({ address }) {
  if (!address) return null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  // TODO(Dev A): optional — copy-to-clipboard on click, optional explorer link.
  return <span className="address-badge" title={address}>{short}</span>;
}
