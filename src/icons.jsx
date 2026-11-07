const P = {
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" /><path d="M3.5 3.5v5h5" /><path d="M12 7.5V12l3 2" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></>,
  chip: <><rect x="5" y="5" width="14" height="14" rx="3" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></>,
  thermo: <path d="M14 14.8V5a2.5 2.5 0 0 0-5 0v9.8a4.5 4.5 0 1 0 5 0Z" />,
  drop: <path d="M12 2.8s6.2 6.2 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 9 12 2.8 12 2.8Z" />,
  wind: <><path d="M3 8h10.5a2.7 2.7 0 1 0-2.7-2.7" /><path d="M3 12h14.5a2.7 2.7 0 1 1-2.7 2.7" /><path d="M3 16h6" /></>,
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.8" /></>,
  alert: <><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  leaf: <><path d="M20 4c-9 0-14 4-14 10 0 2 .6 3.6 1.6 4.8" /><path d="M20 4c0 9-4 14-10 14-1 0-2-.1-2.4-.2" /><path d="M5 21c1-4 3.5-7.5 8-10" /></>,
  camera: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.3-2h5.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export function Icon({ n, size = 20, sw = 1.8, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {P[n]}
    </svg>
  );
}

export function Logo({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#2fb47c" />
      <path d="M20 8.5 29.5 12v7.2c0 5.6-3.9 9.8-9.5 12-5.6-2.2-9.5-6.4-9.5-12V12L20 8.5Z" fill="#fff" />
      <path d="M20 27v-8.5M20 21.5c0-2.6-1.9-4.4-4.7-4.4 0 2.6 1.9 4.4 4.7 4.4ZM20 23.5c0-2.3 1.7-3.9 4.3-3.9 0 2.3-1.7 3.9-4.3 3.9Z"
        fill="none" stroke="#17694d" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

