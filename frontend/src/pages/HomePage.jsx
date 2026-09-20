// ─────────────────────────────────────────────────────────
// Home Page — public landing page for FleetLink
// ─────────────────────────────────────────────────────────
// Sections:
//   1. Hero — headline + CTA buttons
//   2. Stats bar — key platform numbers
//   3. How It Works — 3-step cards
//   4. Vehicle Categories — browse by type
//   5. CTA Banner — call to action for sign-up / list your fleet
//   6. Footer

import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'

function HomePage() {
  return (
    <>
      {/* ════════════════════════════════════════════════ */}
      {/* HERO SECTION                                     */}
      {/* ════════════════════════════════════════════════ */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="hero-badge-icon">⭐</span>
              #1 Vehicle Rental Platform in India
            </div>

            <h1 className="hero-title">
              Rent Your Perfect Ride With{' '}
              <span className="highlight">Top Rental Stores</span>{' '}
              Across The Country
            </h1>

            <p className="hero-subtitle">
              Discover cars, bikes, scooters and bicycles from trusted local
              rental stores. Book instantly, pay securely, and hit the road
              in minutes.
            </p>

            <div className="hero-actions">
              <Link to="/vehicles" className="btn btn-primary">
                Browse Vehicles <span className="btn-arrow">→</span>
              </Link>

              <SignedOut>
                <Link to="/sign-up" className="btn btn-outline">
                  Get Started
                </Link>
              </SignedOut>

              <SignedIn>
                <Link to="/my-bookings" className="btn btn-outline">
                  My Bookings
                </Link>
              </SignedIn>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-illustration">🚗</div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* STATS BAR                                        */}
      {/* ════════════════════════════════════════════════ */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-icon">🏪</div>
          <div className="stat-content">
            <h3>50+</h3>
            <p>Rental Stores</p>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-icon">🚘</div>
          <div className="stat-content">
            <h3>200+</h3>
            <p>Vehicles</p>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-icon">📂</div>
          <div className="stat-content">
            <h3>4</h3>
            <p>Categories</p>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>1000+</h3>
            <p>Happy Riders</p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                     */}
      {/* ════════════════════════════════════════════════ */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">How FleetLink Works!</h2>
        </div>

        <div className="how-it-works-grid">
          <div className="how-card">
            <span className="how-card-number">01</span>
            <div className="how-card-icon blue">👤</div>
            <h3>Create Account</h3>
            <p>Sign up and verify your identity to get started on your rental journey.</p>
          </div>

          <div className="how-card">
            <span className="how-card-number">02</span>
            <div className="how-card-icon orange">🔍</div>
            <h3>Find & Book a Vehicle</h3>
            <p>Search for vehicles that match your needs, compare prices, and book instantly.</p>
          </div>

          <div className="how-card">
            <span className="how-card-number">03</span>
            <div className="how-card-icon green">🚀</div>
            <h3>Pay & Hit the Road</h3>
            <p>Pay securely via Razorpay checkout and pick up your vehicle from the store.</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* VEHICLE CATEGORIES                               */}
      {/* ════════════════════════════════════════════════ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="categories-header">
          <h2>Vehicle Categories</h2>
          <Link to="/vehicles" className="view-all-link">
            View All Vehicles →
          </Link>
        </div>

        <div className="categories-grid">
          <Link to="/vehicles?category=CAR" className="category-card">
            <div className="category-icon car">🚗</div>
            <h3>Cars</h3>
            <p>Browse Cars</p>
          </Link>

          <Link to="/vehicles?category=BIKE" className="category-card">
            <div className="category-icon bike">🏍️</div>
            <h3>Bikes</h3>
            <p>Browse Bikes</p>
          </Link>

          <Link to="/vehicles?category=SCOOTER" className="category-card">
            <div className="category-icon scooter">🛵</div>
            <h3>Scooters</h3>
            <p>Browse Scooters</p>
          </Link>

          <Link to="/vehicles?category=BICYCLE" className="category-card">
            <div className="category-icon bicycle">🚲</div>
            <h3>Bicycles</h3>
            <p>Browse Bicycles</p>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* CTA BANNER                                       */}
      {/* ════════════════════════════════════════════════ */}
      <section className="section">
        <div className="cta-banner">
          <div className="cta-text">
            <SignedOut>
              <h2>Ready to find your perfect ride?</h2>
              <p>Join thousands of riders who trust FleetLink for their rental needs.</p>
            </SignedOut>

            <SignedIn>
              <h2>Own a fleet? List it on FleetLink!</h2>
              <p>Reach thousands of customers and grow your rental business.</p>
            </SignedIn>
          </div>

          <SignedOut>
            <Link to="/sign-up" className="btn-cta">
              Get Started Now <span className="btn-arrow">→</span>
            </Link>
          </SignedOut>

          <SignedIn>
            <Link to="/list-your-fleet" className="btn-cta">
              List Your Fleet <span className="btn-arrow">→</span>
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* FOOTER                                           */}
      {/* ════════════════════════════════════════════════ */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="navbar-logo">
              <span className="navbar-logo-icon">🚗</span>
              FleetLink
            </div>
            <p>
              Your trusted platform to rent vehicles from
              local stores and explore the road ahead.
            </p>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/vehicles">Browse Vehicles</Link></li>
              <li><Link to="/my-bookings">My Bookings</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          © 2026 FleetLink. Built with ❤️ for riders everywhere.
        </div>
      </footer>
    </>
  )
}

export default HomePage
