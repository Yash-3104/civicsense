import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StaffManagement from "./pages/admin/StaffManagement";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import PublicTransparencyDashboard from "./pages/public/PublicTransparencyDashboard";
import OperationsMap from "./pages/OperationsMap";

function App() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/transparency" element={<PublicTransparencyDashboard />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["CITIZEN", "ADMIN", "OFFICER", "WORKER", "SUPERVISOR"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <StaffManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/supervisor"
          element={
            <ProtectedRoute allowedRoles={["SUPERVISOR", "ADMIN"]}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/map"
          element={
            <ProtectedRoute allowedRoles={["CITIZEN", "ADMIN", "SUPERVISOR", "WORKER", "OFFICER"]}>
              <OperationsMap />
            </ProtectedRoute>
          }
        />

        <Route
          path="/worker"
          element={
            <ProtectedRoute allowedRoles={["WORKER", "OFFICER", "ADMIN", "SUPERVISOR"]}>
              <WorkerDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="*" element={<LandingPage />} />
      </Routes>
    </div>
  );
}

export default App;
