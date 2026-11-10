import { Link } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import heroBackdrop from '../assets/hero-night-violet.png'

const iconPaths = {
  store: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10M9 20v-6h6v6M3 10v2a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0v-2" /></>,
  car: <><path d="m5 11 1.4-4.1A2 2 0 0 1 8.3 5.5h7.4a2 2 0 0 1 1.9 1.4L19 11" /><path d="M3.5 11h17v6.5h-17zM5.5 17.5v2M18.5 17.5v2" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="16.5" cy="17.5" r="2" /><path d="M4 13h3m10 0h3" /></>,
  bike: <><circle cx="5.5" cy="17.5" r="3" /><circle cx="18.5" cy="17.5" r="3" /><path d="m5.5 17.5 4-7h4l5 7m-9-7 4 7h5M9 10H6m6-3h3m-2 0 2 3" /></>,
  scooter: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 18h8l-2-8h3l2 8M12 10l1-4h3m-4 12V8" /><path d="M4 10h5" /></>,
  bicycle: <><circle cx="5.5" cy="17.5" r="3" /><circle cx="18.5" cy="17.5" r="3" /><path d="m5.5 17.5 4-7h4l5 7m-9-7 4 7h5M9 10H6m6-3h3m-2 0 2 3" /></>,
  riders: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  shield: <><path d="M12 3 20 6v5.5c0 4.7-3.1 7.8-8 9.5-4.9-1.7-8-4.8-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
}

function Icon({ name, size = 24, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}

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
              <span className="hero-badge-icon"><Icon name="spark" size={17} /></span>
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
                Browse vehicles <Icon name="arrow" size={18} />
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
              <span className="home-trust-icon"><Icon name="shield" size={17} /></span>
              Secure payments <span className="home-trust-dot" /> Trusted local stores
            </div>
          </div>

        </div>
        <div className="home-hero-callout home-hero-callout-store">
          <span className="home-callout-icon"><Icon name="store" size={19} /></span>
          <span><strong>Local rentals</strong><small>Ready when you are</small></span>
        </div>
        <div className="home-hero-callout home-hero-callout-secure">
          <span className="home-callout-icon"><Icon name="shield" size={18} /></span>
          <span><strong>Easy & secure</strong><small>Book with confidence</small></span>
        </div>
      </section>

      <div className="stats-bar home-stats">
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><Icon name="store" size={22} /></div>
          <div className="stat-content"><h3>50+</h3><p>Rental stores</p></div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><Icon name="bike" size={22} /></div>
          <div className="stat-content"><h3>4</h3><p>Ride categories</p></div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><Icon name="car" size={22} /></div>
          <div className="stat-content"><h3>200+</h3><p>Vehicles</p></div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item home-stat-item">
          <div className="stat-icon home-stat-icon"><Icon name="riders" size={22} /></div>
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
              <div className="how-card-icon home-step-icon"><Icon name={step.icon} size={25} /></div>
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
            View all vehicles <Icon name="arrow" size={17} />
          </Link>
        </div>

        <div className="categories-grid home-categories-grid">
          {categories.map((category) => (
            <Link to={`/vehicles?category=${category.key}`} className="category-card home-category-card" key={category.key}>
              <div className="category-icon home-category-icon"><Icon name={category.icon} size={29} /></div>
              <h3>{category.name}</h3>
              <p>{category.detail}</p>
              <span className="home-category-arrow"><Icon name="arrow" size={17} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section home-section home-cta-section">
        <div className="cta-banner home-cta-banner">
          <div className="home-cta-mark"><Icon name="spark" size={24} /></div>
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
              Get started <Icon name="arrow" size={18} />
            </Link>
          </SignedOut>

          <SignedIn>
            <Link to="/list-your-fleet" className="btn-cta home-cta-button">
              List your fleet <Icon name="arrow" size={18} />
            </Link>
          </SignedIn>
        </div>
      </section>

      <footer className="footer home-footer">
        <div className="footer-content home-footer-content">
          <div className="footer-brand home-footer-brand">
            <div className="footer-logo-text home-footer-logo">
              <span className="home-footer-mark"><Icon name="car" size={19} /></span>
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
