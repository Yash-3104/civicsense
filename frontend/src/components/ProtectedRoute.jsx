import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/store/useAuthStore";

function getRoleHome(role) {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "SUPERVISOR":
      return "/supervisor";
    case "WORKER":
    case "OFFICER":
      return "/worker";
    case "CITIZEN":
    default:
      return "/dashboard";
  }
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  return children;
}
