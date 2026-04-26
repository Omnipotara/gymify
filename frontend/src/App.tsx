import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GymListPage from './pages/GymListPage';
import GymPage from './pages/GymPage';
import AdminPage from './pages/AdminPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RewardsAdminPage from './pages/RewardsAdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/gyms"
        element={
          <RequireAuth>
            <GymListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/gyms/:gymId"
        element={
          <RequireAuth>
            <GymPage />
          </RequireAuth>
        }
      />
      <Route
        path="/gyms/:gymId/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/gyms/:gymId/admin/analytics"
        element={
          <RequireAuth>
            <AnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/gyms/:gymId/admin/rewards"
        element={
          <RequireAuth>
            <RewardsAdminPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
