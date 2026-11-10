// ─────────────────────────────────────────────────────────
// Navbar — persistent top navigation bar
// ─────────────────────────────────────────────────────────
// Shows:
//   - Logo (always)
//   - Nav links vary by auth state + role:
//       Signed out:  Home, Browse Vehicles
//       CUSTOMER:    Home, Browse Vehicles, My Bookings, List Your Fleet
//       STORE_OWNER: Home, Browse Vehicles, My Bookings, Dashboard, Store Bookings
//   - Auth area: Sign In/Up buttons OR Clerk's UserButton

import { Link, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useLocalUser } from '../context/UserContext.jsx'
import AppIcon from './AppIcon.jsx'

function Navbar() {
  const location = useLocation()
  const { isCustomer, isStoreOwner, isUserLoaded } = useLocalUser()

  // Helper: returns 'active' class if the current path starts with the given prefix
  const isActive = (path) => location.pathname === path ? 'active' : ''

  return (
    <header className="navbar">
      {/* ── Left: Logo ───────────────────────────────── */}
      <div className="navbar-left">
        <Link to="/" className="navbar-logo">
          <span className="navbar-logo-icon"><AppIcon name="car" size={21} /></span>
          FleetLink
        </Link>
      </div>

      {/* ── Center: Nav Links ────────────────────────── */}
      <nav>
        <ul className="navbar-links">
          {/* Always visible */}
          <li>
            <Link to="/" className={isActive('/')}>
              <span className="nav-icon"><AppIcon name="home" size={18} /></span> Home
            </Link>
          </li>
          <li>
            <Link to="/vehicles" className={isActive('/vehicles')}>
              <span className="nav-icon"><AppIcon name="search" size={18} /></span> Browse Vehicles
            </Link>
          </li>

          {/* Signed-in: any role */}
          <SignedIn>
            <li>
              <Link to="/my-bookings" className={isActive('/my-bookings')}>
                <span className="nav-icon"><AppIcon name="calendar" size={18} /></span> My Bookings
              </Link>
            </li>

            {/* CUSTOMER only: upgrade CTA */}
            {isUserLoaded && isCustomer && (
              <li>
                <Link to="/list-your-fleet" className={isActive('/list-your-fleet')}>
                  <span className="nav-icon"><AppIcon name="store" size={18} /></span> List Your Fleet
                </Link>
              </li>
            )}

            {/* STORE_OWNER only: management links */}
            {isUserLoaded && isStoreOwner && (
              <>
                <li>
                  <Link to="/store/dashboard" className={isActive('/store/dashboard')}>
                    <span className="nav-icon"><AppIcon name="grid" size={18} /></span> Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/store/bookings" className={isActive('/store/bookings')}>
                    <span className="nav-icon"><AppIcon name="list" size={18} /></span> Store Bookings
                  </Link>
                </li>
              </>
            )}
          </SignedIn>
        </ul>
      </nav>

      {/* ── Right: Auth Area ─────────────────────────── */}
      <div className="navbar-auth">
        <SignedOut>
          <Link to="/sign-in" className="btn-signin">Sign In</Link>
          <Link to="/sign-up" className="btn-signup">Sign Up</Link>
        </SignedOut>

        <SignedIn>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: { width: 36, height: 36 },
              },
            }}
          />
        </SignedIn>
      </div>
    </header>
  )
}

export default Navbar
