import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import GymListPage from './pages/GymListPage';
import GymPage from './pages/GymPage';
import AdminPage from './pages/AdminPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RewardsAdminPage from './pages/RewardsAdminPage';
import ProfilePage from './pages/ProfilePage';
import MemberProfileAdminPage from './pages/MemberProfileAdminPage';
import CheckinDisplayPage from './pages/CheckinDisplayPage';
import SuperAdminPage from './pages/SuperAdminPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Check-in display — full-screen, no sidebar */}
      <Route
        path="/gyms/:gymId/checkin-display"
        element={
          <RequireAuth>
            <CheckinDisplayPage />
          </RequireAuth>
        }
      />

      {/* All other protected pages use the sidebar layout */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/gyms" element={<GymListPage />} />
        <Route path="/gyms/:gymId" element={<GymPage />} />
        <Route path="/gyms/:gymId/admin" element={<AdminPage />} />
        <Route path="/gyms/:gymId/admin/analytics" element={<AnalyticsPage />} />
        <Route path="/gyms/:gymId/admin/rewards" element={<RewardsAdminPage />} />
        <Route path="/gyms/:gymId/admin/members/:userId" element={<MemberProfileAdminPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/super-admin" element={<SuperAdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
