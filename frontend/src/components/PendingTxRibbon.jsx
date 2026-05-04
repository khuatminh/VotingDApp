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
