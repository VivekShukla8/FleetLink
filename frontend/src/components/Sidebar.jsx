// ─────────────────────────────────────────────────────────
// Sidebar — Left navigation panel (replaces top Navbar)
// ─────────────────────────────────────────────────────────
// Matches the reference design: dark gradient sidebar with
// logo at top, nav links with icons, role-based visibility.

import { Link, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import logoSvg from '../assets/logo.svg'

function Sidebar() {
  const location = useLocation()
  const { isCustomer, isStoreOwner, isUserLoaded } = useLocalUser()

  const isActive = (path) => location.pathname === path ? 'sidebar-link active' : 'sidebar-link'

  return (
    <aside className="sidebar">
      {/* ── Logo ─────────────────────────────────────── */}
      <div className="sidebar-logo-area">
        <Link to="/" className="sidebar-logo">
          <img src={logoSvg} alt="FleetLink" className="sidebar-logo-img" />
        </Link>
      </div>

      {/* ── Navigation ───────────────────────────────── */}
      <nav className="sidebar-nav">
        <Link to="/store/dashboard" className={isActive('/store/dashboard')}>
          <span className="sidebar-icon">📊</span>
          Dashboard
        </Link>

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

          {/* STORE_OWNER links */}
          {isUserLoaded && isStoreOwner && (
            <>
              <Link to="/store/bookings" className={isActive('/store/bookings')}>
                <span className="sidebar-icon">📦</span>
                Store Bookings
              </Link>

              <Link to="/store/dashboard" className={isActive('/store/analytics')}>
                <span className="sidebar-icon">📈</span>
                Analytics
              </Link>

              <Link to="/store/dashboard" className={isActive('/store/fleet')}>
                <span className="sidebar-icon">🚗</span>
                Manage Fleet
              </Link>

              <Link to="/store/dashboard" className={isActive('/store/stores')}>
                <span className="sidebar-icon">🏪</span>
                Stores
              </Link>
            </>
          )}

          {/* CUSTOMER only: upgrade CTA */}
          {isUserLoaded && isCustomer && (
            <Link to="/list-your-fleet" className={isActive('/list-your-fleet')}>
              <span className="sidebar-icon">🏪</span>
              List Your Fleet
            </Link>
          )}
        </SignedIn>
      </nav>

      {/* ── Bottom: Sign In (when signed out) ────────── */}
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
    </aside>
  )
}

export default Sidebar

