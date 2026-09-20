// ─────────────────────────────────────────────────────────
// ProtectedRoute — auth + role guard
// ─────────────────────────────────────────────────────────
//
// Usage:
//   // Any authenticated user:
//   <Route path="/my-bookings" element={
//     <ProtectedRoute>
//       <MyBookingsPage />
//     </ProtectedRoute>
//   } />
//
//   // Only STORE_OWNER role:
//   <Route path="/store/dashboard" element={
//     <ProtectedRoute allowedRoles={['STORE_OWNER']}>
//       <StoreDashboard />
//     </ProtectedRoute>
//   } />
//
// How it works:
//   useLocalUser() returns { localUser, isUserLoaded, role }.
//   isUserLoaded is FALSE while EITHER:
//     (a) Clerk is still hydrating the session cookie, OR
//     (b) The /api/v1/auth/me fetch is still in flight.
//   This is handled inside UserContext — the effect doesn't
//   set isUserLoaded=true until Clerk loads AND the fetch
//   completes (or the user is confirmed not signed in).
//   So we only need ONE loading check here, not two.
//
// Three states:
//   1. isUserLoaded === false → spinner (Clerk or /auth/me still loading)
//   2. isUserLoaded && !localUser → not signed in → redirect to /sign-in
//   3. isUserLoaded && localUser → signed in:
//      a. allowedRoles provided & role not in list → redirect to /
//      b. otherwise → render children

import { Navigate, useLocation } from 'react-router-dom'
import { useLocalUser } from '../context/UserContext.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const { localUser, isUserLoaded, role } = useLocalUser()
  const location = useLocation()

  // ── State 1: Still loading ───────────────────────────
  // Either Clerk is determining auth state, or the
  // /api/v1/auth/me fetch hasn't completed yet.
  // Show a spinner to avoid flashing the login page for
  // someone who's actually signed in.
  if (!isUserLoaded) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  // ── State 2: Not signed in ──────────────────────────
  // localUser is null when the user is not authenticated.
  // Redirect to sign-in, preserving the intended URL so
  // we can redirect back after successful login.
  if (!localUser) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  // ── State 3: Signed in — check role ─────────────────
  // If allowedRoles is provided, verify the user's role
  // from our backend DB is in the allowed list.
  // If not → redirect home (not a dead-end "unauthorized" page).
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  // ── All checks passed — render the page ─────────────
  return children
}

export default ProtectedRoute
