// ─────────────────────────────────────────────────────────
// Entry Point — React + Clerk Provider + Router
// ─────────────────────────────────────────────────────────
// Provider nesting order matters:
//   ClerkProvider → provides auth primitives (useAuth, getToken)
//   BrowserRouter → provides routing context
//   UserProvider  → watches Clerk auth, fetches local DB user ONCE
//   App           → everything else

import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import { UserProvider } from './context/UserContext.jsx'
import App from './App.jsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error(
    'Missing VITE_CLERK_PUBLISHABLE_KEY in your .env file. ' +
    'Get it from https://dashboard.clerk.com → API Keys'
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <UserProvider>
          <App />
        </UserProvider>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
)
