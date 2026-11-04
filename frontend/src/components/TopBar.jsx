// ─────────────────────────────────────────────────────────
// TopBar — Horizontal bar above main content
// ─────────────────────────────────────────────────────────
// Shows search bar (Ctrl+K) + user profile area.

import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import { Link } from 'react-router-dom'

function TopBar() {
  const { localUser } = useLocalUser()

  // Role label for display
  const roleLabel = {
    CUSTOMER: 'Customer',
    STORE_OWNER: 'Fleet Manager',
    ADMIN: 'Administrator',
  }

  return (
    <header className="topbar">
      {/* ── Search Bar ──────────────────────────────── */}
      <div className="topbar-search">
        <span className="topbar-search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search vehicles, stores, or bookings..."
          className="topbar-search-input"
          readOnly
        />
        <kbd className="topbar-kbd">Ctrl + K</kbd>
      </div>

      {/* ── Right: User Profile ────────────────────── */}
      <div className="topbar-right">
        <SignedIn>
          {/* Notification bell */}
          <button className="topbar-icon-btn" title="Notifications">
            🔔
          </button>

          {/* User info */}
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

