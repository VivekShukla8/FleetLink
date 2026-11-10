const icons = {
  alert: <><path d="M10.3 3.9 2.6 17.2a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  battery: <><rect x="3" y="7" width="17" height="10" rx="2" /><path d="M22 10v4M7 10v4m4-4v4" /></>,
  bike: <><circle cx="5.5" cy="17.5" r="3" /><circle cx="18.5" cy="17.5" r="3" /><path d="m5.5 17.5 4-7h4l5 7m-9-7 4 7h5M9 10H6m6-3h3m-2 0 2 3" /></>,
  bicycle: <><circle cx="5.5" cy="17.5" r="3" /><circle cx="18.5" cy="17.5" r="3" /><path d="m5.5 17.5 4-7h4l5 7m-9-7 4 7h5M9 10H6m6-3h3m-2 0 2 3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18m-13 4h3m-3 3h6" /></>,
  car: <><path d="m5 11 1.4-4.1A2 2 0 0 1 8.3 5.5h7.4a2 2 0 0 1 1.9 1.4L19 11" /><path d="M3.5 11h17v6.5h-17zM5.5 17.5v2M18.5 17.5v2" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="16.5" cy="17.5" r="2" /><path d="M4 13h3m10 0h3" /></>,
  chart: <><path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="11" width="7" height="10" rx="1" /></>,
  home: <><path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" /></>,
  key: <><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 8-8L22 6l-2 2 2 2-3 3-2-2-3 3" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
  riders: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  shield: <><path d="M12 3 20 6v5.5c0 4.7-3.1 7.8-8 9.5-4.9-1.7-8-4.8-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  scooter: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 18h8l-2-8h3l2 8M12 10l1-4h3m-4 12V8M4 10h5" /></>,
  seat: <><path d="M7 4v9a3 3 0 0 0 3 3h7v4M7 12h7a3 3 0 0 1 3 3v1M7 5h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1.9-1 1.8-1.4-.4a7.7 7.7 0 0 1-1.4.8l-.3 1.5h-2.1l-.4-1.4a7.7 7.7 0 0 1-1.6 0l-.4 1.4H9.9l-.3-1.5a7.7 7.7 0 0 1-1.4-.8l-1.4.4-1-1.8 1.1-.9a7.7 7.7 0 0 1 0-1.6l-1.1-.9 1-1.8 1.4.4a7.7 7.7 0 0 1 1.4-.8l.3-1.5H12l.4 1.4a7.7 7.7 0 0 1 1.6 0l.4-1.4h2.1l.3 1.5a7.7 7.7 0 0 1 1.4.8l1.4-.4 1 1.8-1.1.9a7.7 7.7 0 0 1-.1 1.6Z" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  store: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10M9 20v-6h6v6M3 10v2a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0v-2" /></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2" /></>,
  wrench: <><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" /></>,
}

export const VEHICLE_ICON_NAMES = {
  CAR: 'car',
  BIKE: 'bike',
  SCOOTER: 'scooter',
  BICYCLE: 'bicycle',
}

export default function AppIcon({ name = 'grid', size = 20, className = '', strokeWidth = 1.8 }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {icons[name] || icons.grid}
    </svg>
  )
}

export function VehicleIcon({ category, ...props }) {
  return <AppIcon name={VEHICLE_ICON_NAMES[category] || 'car'} {...props} />
}
