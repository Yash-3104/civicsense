import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StaffManagement from "./pages/admin/StaffManagement";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import PublicTransparencyDashboard from "./pages/public/PublicTransparencyDashboard";

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        {/* Public Transparency Dashboard */}
        <Route path="/transparency" element={<PublicTransparencyDashboard />} />

        {/* Citizen Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Staff Management */}
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute>
              <StaffManagement />
            </ProtectedRoute>
          }
        />

        {/* Supervisor Dashboard */}
        <Route
          path="/supervisor"
          element={
            <ProtectedRoute>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Worker Dashboard */}
        <Route
          path="/worker"
          element={
            <ProtectedRoute>
              <WorkerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </div>
  );
}

export default App;
