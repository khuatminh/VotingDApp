import React from 'react';
import { useParams, Link } from 'react-router-dom';

export default function ElectionDetailPage(props) {
  const { id } = useParams();
  return (
    <div className="container admin-page">
      <Link to="/vote" style={{ color: 'var(--ink-3)', fontSize: 13 }}>← Back to elections</Link>
      <h2 style={{ marginTop: 12 }}>Election #{id}</h2>
      <p style={{ color: 'var(--ink-3)' }}>Detail page coming up.</p>
    </div>
  );
}
