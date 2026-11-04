// ─────────────────────────────────────────────────────────
// Sidebar — pixel-matched to reference design
// ─────────────────────────────────────────────────────────

import { Link, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import logoSvg from '../assets/logo.svg'
import roadArt from '../assets/road-art.svg'

// ── Outline SVG icons (line style, matching reference) ──
const icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/>
    </svg>
  ),
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/>
    </svg>
  ),
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  bookings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>
    </svg>
  ),
  storeBookings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>
  ),
  listFleet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v6H3zM3 13h8v8H3z"/><path d="M15 13h6v8h-6z"/>
    </svg>
  ),
}

function Sidebar() {
  const location = useLocation()
  const { isCustomer, isStoreOwner, isUserLoaded } = useLocalUser()

  const isActive = (path) =>
    location.pathname === path ? 'sidebar-link active' : 'sidebar-link'

  return (
    <aside className="sidebar">
      {/* ── Logo ─────────────────────────────────────── */}
      <div className="sidebar-logo-area">
        <Link to="/" className="sidebar-logo-card">
          <img src={logoSvg} alt="FleetLink" className="sidebar-logo-img" />
        </Link>
      </div>

      {/* ── Nav Links ────────────────────────────────── */}
      <nav className="sidebar-nav">
        <SignedIn>
          {isUserLoaded && isStoreOwner && (
            <Link to="/store/dashboard" className={isActive('/store/dashboard')}>
              <span className="sidebar-icon">{icons.dashboard}</span>
              Dashboard
            </Link>
          )}
        </SignedIn>

        <Link to="/" className={isActive('/')}>
          <span className="sidebar-icon">{icons.home}</span>
          Home
        </Link>

        <Link to="/vehicles" className={isActive('/vehicles')}>
          <span className="sidebar-icon">{icons.search}</span>
          Browse Vehicles
        </Link>

        <SignedIn>
          <Link to="/my-bookings" className={isActive('/my-bookings')}>
            <span className="sidebar-icon">{icons.bookings}</span>
            My Bookings
          </Link>

          {isUserLoaded && isStoreOwner && (
            <Link to="/store/bookings" className={isActive('/store/bookings')}>
              <span className="sidebar-icon">{icons.storeBookings}</span>
              Store Bookings
            </Link>
          )}

          {isUserLoaded && isCustomer && (
            <Link to="/list-your-fleet" className={isActive('/list-your-fleet')}>
              <span className="sidebar-icon">{icons.listFleet}</span>
              List Your Fleet
            </Link>
          )}
        </SignedIn>
      </nav>

      {/* ── Auth buttons (signed out) ────────────────── */}
      <SignedOut>
        <div className="sidebar-bottom">
          <Link to="/sign-in" className="sidebar-signin-btn">Sign In</Link>
          <Link to="/sign-up" className="sidebar-signup-btn">Sign Up</Link>
        </div>
      </SignedOut>

      {/* ── Road illustration ────────────────────────── */}
      <div className="sidebar-road">
        <img src={roadArt} alt="" className="sidebar-road-img" />
      </div>
    </aside>
  )
}

export default Sidebar
