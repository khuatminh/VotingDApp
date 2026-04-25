import { Navigate, Route, Routes } from 'react-router-dom';
import Layout      from './components/Layout.jsx';
import AdminPage   from './pages/AdminPage.jsx';
import VotePage    from './pages/VotePage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index             element={<Navigate to="/vote" replace />} />
        <Route path="admin"      element={<AdminPage />} />
        <Route path="vote"       element={<VotePage />} />
        <Route path="results"    element={<ResultsPage />} />
        <Route path="*"          element={<Navigate to="/vote" replace />} />
      </Route>
    </Routes>
  );
}
