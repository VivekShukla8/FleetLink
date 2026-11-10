// ─────────────────────────────────────────────────────────
// Sidebar — pixel-matched to reference design
// ─────────────────────────────────────────────────────────

import { Link, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import AppIcon from './AppIcon.jsx'
import logoSvg from '../assets/logo.svg'
import roadArt from '../assets/road-art.svg'

// Shared outline icon set keeps the sidebar consistent with page controls.
const icons = {
  dashboard: <AppIcon name="grid" size={20} />,
  home: <AppIcon name="home" size={20} />,
  search: <AppIcon name="search" size={20} />,
  bookings: <AppIcon name="calendar" size={20} />,
  storeBookings: <AppIcon name="list" size={20} />,
  listFleet: <AppIcon name="store" size={20} />,
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
