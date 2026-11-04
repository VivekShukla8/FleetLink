// ─────────────────────────────────────────────────────────
// Sidebar — Left navigation panel
// ─────────────────────────────────────────────────────────
// Matches reference: dark gradient, logo card at top,
// nav links with icons, road illustration at bottom.
// Only links to pages that exist in the app.

import { Link, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import logoSvg from '../assets/logo.svg'

function Sidebar() {
  const location = useLocation()
  const { isCustomer, isStoreOwner, isUserLoaded } = useLocalUser()

  const isActive = (path) =>
    location.pathname === path ? 'sidebar-link active' : 'sidebar-link'

  return (
    <aside className="sidebar">
      {/* ── Logo Card ────────────────────────────────── */}
      <div className="sidebar-logo-area">
        <Link to="/" className="sidebar-logo-card">
          <img src={logoSvg} alt="FleetLink" className="sidebar-logo-img" />
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────── */}
      <nav className="sidebar-nav">
        {/* Store owner: Dashboard first */}
        <SignedIn>
          {isUserLoaded && isStoreOwner && (
            <Link to="/store/dashboard" className={isActive('/store/dashboard')}>
              <span className="sidebar-icon">📊</span>
              Dashboard
            </Link>
          )}
        </SignedIn>

        <Link to="/" className={isActive('/')}>
          <span className="sidebar-icon">🏠</span>
          Home
        </Link>

        <Link to="/vehicles" className={isActive('/vehicles')}>
          <span className="sidebar-icon">🔍</span>
          Browse Vehicles
        </Link>

        <SignedIn>
          <Link to="/my-bookings" className={isActive('/my-bookings')}>
            <span className="sidebar-icon">📋</span>
            My Bookings
          </Link>

          {isUserLoaded && isStoreOwner && (
            <Link to="/store/bookings" className={isActive('/store/bookings')}>
              <span className="sidebar-icon">📦</span>
              Store Bookings
            </Link>
          )}

          {isUserLoaded && isCustomer && (
            <Link to="/list-your-fleet" className={isActive('/list-your-fleet')}>
              <span className="sidebar-icon">🏪</span>
              List Your Fleet
            </Link>
          )}
        </SignedIn>
      </nav>

      {/* ── Bottom: Auth buttons (signed out) ─────────── */}
      <SignedOut>
        <div className="sidebar-bottom">
          <Link to="/sign-in" className="sidebar-signin-btn">
            Sign In
          </Link>
          <Link to="/sign-up" className="sidebar-signup-btn">
            Sign Up
          </Link>
        </div>
      </SignedOut>

      {/* ── Road illustration (CSS-driven) ───────────── */}
      <div className="sidebar-road-art" />
    </aside>
  )
}

export default Sidebar
