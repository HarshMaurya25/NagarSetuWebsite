import React from "react";
import { Navigate } from "react-router-dom";
import { getRole, isAuthenticated } from "../../lib/session";

export default function ProtectedRoute({ children, allowRoles = [] }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const role = getRole(); // already normalized to uppercase by getRole() helper
  if (allowRoles.length && !allowRoles.map((r) => r.toUpperCase()).includes(role)) {
    // If the user is authenticated but doesn't have the role for this path,
    // redirect them to their own dashboard instead of a generic one.
    const fallback =
      role === "SUPERVISOR" ? "/supervisor/dashboard" : "/admin/dashboard";

    // Prevent redirect loop: if we are already headed to the fallback, don't redirect again
    if (window.location.hash.includes(fallback)) {
      return <Navigate to="/login" replace />;
    }

    return <Navigate to={fallback} replace />;
  }

  return children;
}
