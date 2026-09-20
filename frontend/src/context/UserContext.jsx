// ─────────────────────────────────────────────────────────
// UserContext — fetches and caches the local DB user
// ─────────────────────────────────────────────────────────
//
// Problem this solves:
//   Clerk tells us WHO the user is (email, Clerk ID), but not
//   their role (CUSTOMER vs STORE_OWNER) — that lives in our
//   MySQL database. We need to fetch it once per session and
//   share it across all components without redundant API calls.
//
// Architecture:
//   ClerkProvider (provides isSignedIn, getToken)
//     └── UserProvider (watches isSignedIn, fetches /auth/me ONCE)
//           └── App
//                 └── ProtectedRoute (reads localUser.role via useLocalUser)
//                 └── Navbar (reads localUser.role to show/hide links)
//
// State machine:
//   1. Clerk not loaded yet → isUserLoaded = false
//   2. Clerk loaded, user not signed in → isUserLoaded = true, localUser = null
//   3. Clerk loaded, user signed in, /auth/me pending → isUserLoaded = false
//   4. Clerk loaded, user signed in, /auth/me done → isUserLoaded = true, localUser = {...}
//   5. User signs out → isUserLoaded = true, localUser = null (cache cleared)

import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'

const UserContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function UserProvider({ children }) {
  const { isLoaded: isClerkLoaded, isSignedIn, getToken } = useAuth()

  // Local DB user (with role, id, etc.)
  const [localUser, setLocalUser] = useState(null)
  // True once we've either fetched the user or confirmed they're not signed in
  const [isUserLoaded, setIsUserLoaded] = useState(false)
  // Error from the /auth/me call (network failure, server down, etc.)
  const [userError, setUserError] = useState(null)

  useEffect(() => {
    // ── Wait for Clerk to determine auth state ─────────
    if (!isClerkLoaded) {
      return
    }

    // ── User signed out → clear cache immediately ──────
    if (!isSignedIn) {
      setLocalUser(null)
      setIsUserLoaded(true)
      setUserError(null)
      return
    }

    // ── User signed in → fetch local DB user ONCE ──────
    let cancelled = false

    async function fetchLocalUser() {
      setIsUserLoaded(false)
      setUserError(null)

      try {
        const token = await getToken()

        const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.message || `Server returned ${response.status}`)
        }

        const result = await response.json()

        if (!cancelled) {
          setLocalUser(result.data) // { id, clerkId, name, email, phone, role, createdAt }
          setIsUserLoaded(true)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch local user:', err)
          setUserError(err.message)
          setLocalUser(null)
          setIsUserLoaded(true)  // Loaded = true even on error (we know the fetch completed)
        }
      }
    }

    fetchLocalUser()

    // Cleanup: if isSignedIn changes while the fetch is in flight
    // (e.g., user signs out immediately after signing in), don't
    // update state with stale data.
    return () => {
      cancelled = true
    }
  }, [isClerkLoaded, isSignedIn, getToken])

  const value = {
    localUser,      // null if not signed in or fetch pending
    isUserLoaded,   // false while Clerk is loading OR /auth/me is pending
    userError,      // error message string if /auth/me failed
    setLocalUser,   // setter — use after a backend call that changes the user (e.g., role upgrade)
    // Convenience getters
    role: localUser?.role ?? null,
    isCustomer: localUser?.role === 'CUSTOMER',
    isStoreOwner: localUser?.role === 'STORE_OWNER',
    isAdmin: localUser?.role === 'ADMIN',
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

/**
 * Hook to access the local DB user.
 *
 * @returns {{
 *   localUser: object | null,
 *   isUserLoaded: boolean,
 *   userError: string | null,
 *   setLocalUser: (user: object) => void,
 *   role: string | null,
 *   isCustomer: boolean,
 *   isStoreOwner: boolean,
 *   isAdmin: boolean,
 * }}
 */
export function useLocalUser() {
  const context = useContext(UserContext)
  if (context === null) {
    throw new Error('useLocalUser() must be used inside <UserProvider>')
  }
  return context
}
