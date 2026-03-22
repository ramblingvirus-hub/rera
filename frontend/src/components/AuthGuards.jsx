import { Navigate, useLocation } from "react-router-dom";

import { isAuthenticated } from "../api/apiClient";
import { resolveRedirectTarget } from "../utils/navigation";

export function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return children;
}

export function GuestRoute({ children }) {
  const location = useLocation();

  if (isAuthenticated()) {
    return (
      <Navigate
        to={resolveRedirectTarget(location.state, "/dashboard")}
        replace
      />
    );
  }

  return children;
}
