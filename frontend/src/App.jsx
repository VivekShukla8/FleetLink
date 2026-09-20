// ─────────────────────────────────────────────────────────
// App — Root Component with Layout + Routing
// ─────────────────────────────────────────────────────────

import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import SignInPage from './pages/SignInPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ListYourFleetPage from './pages/ListYourFleetPage.jsx'
import StoreDashboard from './pages/StoreDashboard.jsx'
import VehicleFormPage from './pages/VehicleFormPage.jsx'
import BrowseVehiclesPage from './pages/BrowseVehiclesPage.jsx'
import VehicleDetailPage from './pages/VehicleDetailPage.jsx'
import MyBookingsPage from './pages/MyBookingsPage.jsx'
import BookingDetailPage from './pages/BookingDetailPage.jsx'
import StoreBookingsPage from './pages/StoreBookingsPage.jsx'

function App() {
  return (
    <div className="app">
      {/* ── Persistent Navbar ─────────────────────────── */}
      <Navbar />

      {/* ── Routes ──────────────────────────────────── */}
      <main>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          {/* Public (for now) — vehicles browse page */}
          <Route path="/vehicles" element={<BrowseVehiclesPage />} />
          <Route path="/vehicles/:id" element={<VehicleDetailPage />} />

          {/* ── Protected routes ─────────────────────── */}
          {/* Any authenticated user */}
          <Route path="/my-bookings" element={
            <ProtectedRoute>
              <MyBookingsPage />
            </ProtectedRoute>
          } />

          <Route path="/bookings/:id" element={
            <ProtectedRoute>
              <BookingDetailPage />
            </ProtectedRoute>
          } />

          {/* Store owner routes */}
          <Route path="/list-your-fleet" element={
            <ProtectedRoute>
              <ListYourFleetPage />
            </ProtectedRoute>
          } />

          <Route path="/store/dashboard" element={
            <ProtectedRoute allowedRoles={['STORE_OWNER']}>
              <StoreDashboard />
            </ProtectedRoute>
          } />

          <Route path="/store/vehicles/new" element={
            <ProtectedRoute allowedRoles={['STORE_OWNER']}>
              <VehicleFormPage />
            </ProtectedRoute>
          } />

          <Route path="/store/vehicles/:id/edit" element={
            <ProtectedRoute allowedRoles={['STORE_OWNER']}>
              <VehicleFormPage />
            </ProtectedRoute>
          } />

          <Route path="/store/bookings" element={
            <ProtectedRoute allowedRoles={['STORE_OWNER']}>
              <StoreBookingsPage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  )
}

export default App

