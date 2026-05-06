// frontend/src/components/ElectionSelector.jsx
import React from 'react'

const STATE_LABELS = { 0: 'NotStarted', 1: 'Ended', 2: 'Open' }

export default function ElectionSelector({ elections, selected, onSelect, loading }) {
  if (loading) {
    return (
      <select className="input" disabled>
        <option>Đang tải…</option>
      </select>
    )
  }
  if (!elections || !elections.length) {
    return (
      <select className="input" disabled>
        <option>Không có cuộc bầu cử nào</option>
      </select>
    )
  }
  return (
    <select
      className="input"
      value={selected?.id ?? ''}
      onChange={e => {
        if (!e.target.value) { onSelect(null); return }
        const id = Number(e.target.value)
        onSelect(elections.find(el => el.id === id) ?? null)
      }}
    >
      <option value="">— Chọn cuộc bầu cử —</option>
      {elections.map(el => (
        <option key={el.id} value={el.id}>
          {el.name} [{STATE_LABELS[el.state] ?? el.state}]
        </option>
      ))}
    </select>
  )
}
