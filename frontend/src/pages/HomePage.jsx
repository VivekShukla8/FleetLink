import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import heroBackdrop from '../assets/hero-night-violet.png'
import AppIcon from '../components/AppIcon.jsx'

const steps = [
  {
    number: '01',
    icon: 'user',
    title: 'Create your account',
    description: 'Sign up and verify your identity to get started on your rental journey.',
  },
  {
    number: '02',
    icon: 'search',
    title: 'Find your ride',
    description: 'Compare trusted local vehicles and choose the one that fits your plans.',
  },
  {
    number: '03',
    icon: 'shield',
    title: 'Book and go',
    description: 'Pay securely, pick up your vehicle, and enjoy the road ahead.',
  },
]

const categories = [
  { key: 'CAR', name: 'Cars', icon: 'car', detail: 'Comfort for every trip' },
  { key: 'BIKE', name: 'Bikes', icon: 'bike', detail: 'Take the scenic route' },
  { key: 'SCOOTER', name: 'Scooters', icon: 'scooter', detail: 'Easy city rides' },
  { key: 'BICYCLE', name: 'Bicycles', icon: 'bicycle', detail: 'Explore at your pace' },
]

function HomePage() {
  return (
    <div className="home-page">
      <section
        className="hero home-hero"
        style={{ '--home-hero-image': `url("${heroBackdrop}")` }}
      >
        <div className="hero-content home-hero-content">
          <div className="hero-text home-hero-text">
            <div className="hero-badge home-hero-badge">
              <span className="hero-badge-icon"><AppIcon name="spark" size={17} /></span>
              Your next ride is closer than you think
            </div>

            <h1 className="hero-title home-hero-title">
              Rent your perfect ride with{' '}
              <span className="highlight">trusted local stores.</span>
            </h1>

            <p className="hero-subtitle home-hero-subtitle">
              Discover cars, bikes, scooters and bicycles near you. Compare your options,
              book securely, and get on the road in minutes.
            </p>

            <div className="hero-actions home-hero-actions">
              <Link to="/vehicles" className="btn btn-primary home-primary-btn">
                Browse vehicles <AppIcon name="arrow" size={18} />
              </Link>

              <SignedOut>
                <Link to="/sign-up" className="btn btn-outline home-secondary-btn">
                  Get started
                </Link>
              </SignedOut>

              <SignedIn>
                <Link to="/my-bookings" className="btn btn-outline home-secondary-btn">
                  My bookings
                </Link>
              </SignedIn>
            </div>

            <div className="home-trust-note">
              <span className="home-trust-icon"><AppIcon name="shield" size={17} /></span>
              Secure payments <span className="home-trust-dot" /> Trusted local stores
            </div>
          </div>

        </div>
        <div className="home-hero-callout home-hero-callout-store">
          <span className="home-callout-icon"><AppIcon name="store" size={19} /></span>
          <span><strong>Local rentals</strong><small>Ready when you are</small></span>
        </div>
        <div className="home-hero-callout home-hero-callout-secure">
          <span className="home-callout-icon"><AppIcon name="shield" size={18} /></span>
          <span><strong>Easy & secure</strong><small>Book with confidence</small></span>
        </div>
      </section>

      <div className="stats-bar home-stats">
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><AppIcon name="store" size={22} /></div>
          <div className="stat-content"><h3>50+</h3><p>Rental stores</p></div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><AppIcon name="bike" size={22} /></div>
          <div className="stat-content"><h3>4</h3><p>Ride categories</p></div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><AppIcon name="car" size={22} /></div>
          <div className="stat-content"><h3>200+</h3><p>Vehicles</p></div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><AppIcon name="riders" size={22} /></div>
          <div className="stat-content"><h3>1000+</h3><p>Happy riders</p></div>
        </div>
      </div>

      <section className="section home-section home-how-section">
        <div className="section-header home-section-header">
          <span className="home-eyebrow">A smoother way to ride</span>
          <h2 className="section-title">How FleetLink works</h2>
          <p className="section-subtitle">Three simple steps from discovery to departure.</p>
        </div>

        <div className="how-it-works-grid home-how-grid">
          {steps.map((step) => (
            <article className="how-card home-how-card" key={step.number}>
              <span className="how-card-number">{step.number}</span>
              <div className="how-card-icon home-step-icon"><AppIcon name={step.icon} size={25} /></div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section home-section home-category-section">
        <div className="categories-header home-categories-header">
          <div>
            <span className="home-eyebrow">Pick your kind of adventure</span>
            <h2>Find a ride for every plan</h2>
          </div>
          <Link to="/vehicles" className="view-all-link home-view-all">
            View all vehicles <AppIcon name="arrow" size={17} />
          </Link>
        </div>

        <div className="categories-grid home-categories-grid">
          {categories.map((category) => (
            <Link to={`/vehicles?category=${category.key}`} className="category-card home-category-card" key={category.key}>
              <div className="category-icon home-category-icon"><AppIcon name={category.icon} size={29} /></div>
              <h3>{category.name}</h3>
              <p>{category.detail}</p>
              <span className="home-category-arrow"><AppIcon name="arrow" size={17} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section home-section home-cta-section">
        <div className="cta-banner home-cta-banner">
          <div className="home-cta-mark"><AppIcon name="spark" size={24} /></div>
          <div className="cta-text home-cta-text">
            <SignedOut>
              <span className="home-cta-eyebrow">Your journey starts here</span>
              <h2>Ready to find your perfect ride?</h2>
              <p>Join riders finding a simpler way to explore with FleetLink.</p>
            </SignedOut>

            <SignedIn>
              <span className="home-cta-eyebrow">For rental partners</span>
              <h2>Own a fleet? Grow with FleetLink.</h2>
              <p>Reach more riders and grow your local rental business.</p>
            </SignedIn>
          </div>

          <SignedOut>
            <Link to="/sign-up" className="btn-cta home-cta-button">
              Get started <AppIcon name="arrow" size={18} />
            </Link>
          </SignedOut>

          <SignedIn>
            <Link to="/list-your-fleet" className="btn-cta home-cta-button">
              List your fleet <AppIcon name="arrow" size={18} />
            </Link>
          </SignedIn>
        </div>
      </section>

      <footer className="footer home-footer">
        <div className="footer-content home-footer-content">
          <div className="footer-brand home-footer-brand">
            <div className="footer-logo-text home-footer-logo">
              <span className="home-footer-mark"><AppIcon name="car" size={19} /></span>
              <strong>FleetLink</strong>
            </div>
            <p>Your trusted platform to rent from local stores and explore the road ahead.</p>
          </div>

          <div className="footer-section">
            <h4>Quick links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/vehicles">Browse vehicles</Link></li>
              <li><Link to="/my-bookings">My bookings</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About us</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Privacy policy</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom home-footer-bottom">
          © 2026 FleetLink. Built for riders everywhere.
        </div>
      </footer>
    </div>
  )
}

export default HomePage
