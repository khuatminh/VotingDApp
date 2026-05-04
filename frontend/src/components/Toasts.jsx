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
