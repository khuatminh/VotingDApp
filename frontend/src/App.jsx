import { useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout          from './components/Layout.jsx';
import AdminPage       from './pages/AdminPage.jsx';
import VotePage        from './pages/VotePage.jsx';
import ResultsPage     from './pages/ResultsPage.jsx';
import Toasts          from './components/Toasts.jsx';
import PendingTxRibbon from './components/PendingTxRibbon.jsx';

export default function App() {
  const [toasts, setToasts]       = useState([]);
  const [pendingTx, setPendingTx] = useState(null);
  const toastSeq = useRef(0);

  function pushToast(msg, kind) {
    const id = ++toastSeq.current;
    setToasts(ts => [...ts, { id, msg, kind }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3500);
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/vote" replace />} />
          <Route path="admin"
            element={<AdminPage pushToast={pushToast} setPendingTx={setPendingTx} />}
          />
          <Route path="vote"    element={<VotePage pushToast={pushToast} setPendingTx={setPendingTx} />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="*"       element={<Navigate to="/vote" replace />} />
        </Route>
      </Routes>
      <Toasts toasts={toasts} />
      <PendingTxRibbon tx={pendingTx} />
    </>
  );
}
