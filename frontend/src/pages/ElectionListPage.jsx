import React, { useMemo, useState } from 'react';
import { useElection } from '../hooks/useElection';
import { useWallet } from '../hooks/useWallet';
import ElectionListCard from '../components/ElectionListCard';

const NOT_STARTED = 0, OPEN = 1, ENDED = 2;

const CHIP_DEFS = [
  { value: OPEN,        label: 'Open' },
  { value: NOT_STARTED, label: 'Not started' },
  { value: ENDED,       label: 'Ended' },
];

export default function ElectionListPage() {
  const { isConnected } = useWallet();
  const { elections, loading } = useElection();
  const [activeStates, setActiveStates] = useState(() => new Set([OPEN, NOT_STARTED]));

  function toggle(value) {
    setActiveStates(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  const filtered = useMemo(
    () => elections.filter(e => activeStates.has(e.state)),
    [elections, activeStates]
  );

  if (!isConnected) {
    return (
      <div className="container admin-page">
        <p style={{ color: 'var(--ink-3)', marginTop: 32 }}>
          Kết nối ví để tham gia bỏ phiếu.
        </p>
      </div>
    );
  }

  return (
    <div className="container admin-page">
      <h2 style={{ marginBottom: 16 }}>Bỏ phiếu</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {CHIP_DEFS.map(def => (
          <button
            key={def.value}
            type="button"
            className={`chip${activeStates.has(def.value) ? ' active' : ''}`}
            onClick={() => toggle(def.value)}
          >
            {def.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-3)' }}>Đang tải…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--ink-3)' }}>Không có cuộc bầu cử nào phù hợp.</p>
      ) : (
        <div className="col gap-16">
          {filtered.map(el => (
            <ElectionListCard key={el.id} election={el} />
          ))}
        </div>
      )}
    </div>
  );
}
