// ─────────────────────────────────────────────────────────
// TopBar — Horizontal bar above main content
// ─────────────────────────────────────────────────────────
// Shows page context on left + user profile on right.
// Search bar lives only on BrowseVehiclesPage.

import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import { Link } from 'react-router-dom'

function TopBar() {
  const { localUser } = useLocalUser()

  const roleLabel = {
    CUSTOMER: 'Customer',
    STORE_OWNER: 'Fleet Manager',
    ADMIN: 'Administrator',
  }

  return (
    <header className="topbar">
      {/* Left side — empty spacer (pages can add breadcrumbs later) */}
      <div />

      {/* ── Right: User Profile ────────────────────────── */}
      <div className="topbar-right">
        <SignedIn>
          <div className="topbar-user">
            <div className="topbar-user-info">
              <span className="topbar-user-name">
                {localUser?.name || 'User'}
              </span>
              <span className="topbar-user-role">
                {roleLabel[localUser?.role] || 'Customer'}
              </span>
            </div>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: { width: 38, height: 38 },
                },
              }}
            />
          </div>
        </SignedIn>

        <SignedOut>
          <Link to="/sign-in" className="btn btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}>
            Sign In
          </Link>
        </SignedOut>
      </div>
    </header>
  )
}

export default TopBar
