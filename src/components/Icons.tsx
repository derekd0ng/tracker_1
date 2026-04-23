// Shared icon library — 16×16 viewBox, 1.4px stroke, round caps, currentColor

interface IconProps { size?: number; color?: string; style?: React.CSSProperties }

const base = (size: number, color: string) => ({
  width: size, height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

// ── Navigation ────────────────────────────────────────────────────────────────

export const IconDashboard = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1"/>
    <rect x="9"   y="1.5" width="5.5" height="5.5" rx="1"/>
    <rect x="1.5" y="9"   width="5.5" height="5.5" rx="1"/>
    <rect x="9"   y="9"   width="5.5" height="5.5" rx="1"/>
  </svg>
);

export const IconWellbeing = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M8 13.5C8 13.5 2 9.5 2 5.5a3 3 0 0 1 6 0 3 3 0 0 1 6 0c0 4-6 8-6 8z"/>
  </svg>
);

export const IconMedications = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <rect x="3" y="1.5" width="10" height="13" rx="2"/>
    <line x1="3" y1="6" x2="13" y2="6"/>
    <line x1="8" y1="8.5" x2="8" y2="12.5"/>
    <line x1="6" y1="10.5" x2="10" y2="10.5"/>
  </svg>
);

export const IconHabits = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <polyline points="3,4.5 5,6.5 8,3.5"/>
    <line x1="10.5" y1="5" x2="14.5" y2="5"/>
    <polyline points="3,9.5 5,11.5 8,8.5"/>
    <line x1="10.5" y1="10" x2="14.5" y2="10"/>
  </svg>
);

// ── Time-of-day slots ────────────────────────────────────────────────────────

export const IconMorning = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="8" cy="8" r="2.8"/>
    <line x1="8" y1="1.5" x2="8" y2="3"/>
    <line x1="8" y1="13" x2="8" y2="14.5"/>
    <line x1="1.5" y1="8" x2="3" y2="8"/>
    <line x1="13" y1="8" x2="14.5" y2="8"/>
    <line x1="3.4" y1="3.4" x2="4.5" y2="4.5"/>
    <line x1="11.5" y1="11.5" x2="12.6" y2="12.6"/>
    <line x1="12.6" y1="3.4" x2="11.5" y2="4.5"/>
    <line x1="4.5" y1="11.5" x2="3.4" y2="12.6"/>
  </svg>
);

export const IconAfternoon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M8 5a3 3 0 1 1 0 6"/>
    <line x1="8" y1="1.5" x2="8" y2="3"/>
    <line x1="8" y1="13" x2="8" y2="14.5"/>
    <line x1="1.5" y1="8" x2="3" y2="8"/>
    <line x1="12.6" y1="3.4" x2="11.5" y2="4.5"/>
    <line x1="4.5" y1="11.5" x2="3.4" y2="12.6"/>
  </svg>
);

export const IconEvening = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M3 10a5 5 0 0 1 10 0"/>
    <line x1="8" y1="3.5" x2="8" y2="5.5"/>
    <line x1="3.4" y1="5.4" x2="4.8" y2="6.8"/>
    <line x1="12.6" y1="5.4" x2="11.2" y2="6.8"/>
    <line x1="1" y1="10" x2="15" y2="10"/>
    <line x1="3" y1="13" x2="13" y2="13"/>
  </svg>
);

export const IconNight = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5.5 5.5 0 1 0 7 7z"/>
  </svg>
);

// ── Check states ──────────────────────────────────────────────────────────────

export const IconCheckSquare = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)} strokeWidth={1}>
    <rect x="2" y="2" width="12" height="12" rx="1.5"/>
    <polyline points="5,8 7,10 11,6"/>
  </svg>
);

export const IconSkipSquare = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)} strokeWidth={1}>
    <rect x="2" y="2" width="12" height="12" rx="1.5"/>
    <line x1="5.5" y1="5.5" x2="10.5" y2="10.5"/>
    <line x1="10.5" y1="5.5" x2="5.5" y2="10.5"/>
  </svg>
);

export const IconEmptySquare = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)} strokeWidth={1}>
    <rect x="2" y="2" width="12" height="12" rx="1.5"/>
  </svg>
);

export const IconCheckCircle = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="8" cy="8" r="6"/>
    <polyline points="5.5,8 7,9.5 10.5,6"/>
  </svg>
);

export const IconEmptyCircle = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="8" cy="8" r="6"/>
  </svg>
);

// ── Actions ───────────────────────────────────────────────────────────────────

export const IconPlus = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <line x1="8" y1="3" x2="8" y2="13"/>
    <line x1="3" y1="8" x2="13" y2="8"/>
  </svg>
);

export const IconList = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <line x1="3" y1="4.5" x2="13" y2="4.5"/>
    <line x1="3" y1="8"   x2="13" y2="8"/>
    <line x1="3" y1="11.5" x2="13" y2="11.5"/>
  </svg>
);

export const IconLayers = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <polygon points="8,1.5 14.5,5 8,8.5 1.5,5"/>
    <polyline points="1.5,9 8,12.5 14.5,9"/>
    <polyline points="1.5,12 8,15.5 14.5,12"/>
  </svg>
);

export const IconSparkle = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.6 3.6l2.1 2.1M10.3 10.3l2.1 2.1M12.4 3.6l-2.1 2.1M5.7 10.3l-2.1 2.1"/>
    <circle cx="8" cy="8" r="2"/>
  </svg>
);

export const IconLightbulb = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M6 12h4M6.5 14h3"/>
    <path d="M5.5 10C4 9 3 7.6 3 6a5 5 0 0 1 10 0c0 1.6-1 3-2.5 4V10h-5v.0z"/>
  </svg>
);

export const IconFlame = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M8.5 1c0 3-3 3.5-3 6.5a3.5 3.5 0 0 0 7 0C12.5 4 9.5 3 8.5 1z"/>
    <path d="M7 10.5c0 1 .5 2 1.5 2"/>
  </svg>
);

// ── Chart / Wellbeing metrics ─────────────────────────────────────────────────

export const IconSmile = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="8" cy="8" r="6.5"/>
    <path d="M5.5 9.5c.5 1 1.5 1.5 2.5 1.5s2-.5 2.5-1.5"/>
    <line x1="5.5" y1="6.5" x2="5.5" y2="6.5" strokeWidth="2" strokeLinecap="round"/>
    <line x1="10.5" y1="6.5" x2="10.5" y2="6.5" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const IconHeartRate = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <polyline points="1,8 4,8 5.5,4 7,12 8.5,6 10,9 11,8 15,8"/>
  </svg>
);

export const IconBloodPressure = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="8" cy="8" r="5.5"/>
    <polyline points="8,8 8,4.5"/>
    <polyline points="8,8 11,9.5"/>
  </svg>
);

export const IconOxygen = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <circle cx="8" cy="7" r="4"/>
    <line x1="8" y1="11" x2="8" y2="14.5"/>
    <line x1="5.5" y1="14.5" x2="10.5" y2="14.5"/>
    <line x1="6" y1="7" x2="10" y2="7"/>
    <line x1="8" y1="5" x2="8" y2="9"/>
  </svg>
);

export const IconMoon = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M13.5 10A6 6 0 0 1 6 2.5 6 6 0 1 0 13.5 10z"/>
  </svg>
);

export const IconTriangleAlert = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M8 2L14.5 13.5H1.5z"/>
    <line x1="8" y1="6.5" x2="8" y2="9.5"/>
    <line x1="8" y1="11.5" x2="8" y2="11.5" strokeWidth="2"/>
  </svg>
);

// ── Misc ──────────────────────────────────────────────────────────────────────

export const IconMic = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <rect x="5" y="1" width="6" height="8" rx="3"/>
    <path d="M3 8a5 5 0 0 0 10 0"/>
    <line x1="8" y1="13" x2="8" y2="15"/>
    <line x1="5" y1="15" x2="11" y2="15"/>
  </svg>
);

export const IconArrowRight = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M6 12l4-4-4-4"/>
  </svg>
);

export const IconPencil = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M11 2l3 3-9 9H2v-3L11 2z"/>
  </svg>
);

export const IconCalendar = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/>
    <line x1="1.5" y1="6.5" x2="14.5" y2="6.5"/>
    <line x1="5"   y1="1"   x2="5"    y2="4"/>
    <line x1="11"  y1="1"   x2="11"   y2="4"/>
    <rect x="4"  y="9" width="2" height="2" rx="0.5"/>
    <rect x="7"  y="9" width="2" height="2" rx="0.5"/>
    <rect x="10" y="9" width="2" height="2" rx="0.5"/>
  </svg>
);

export const IconStar = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <path d="M8 1.5l1.7 3.4 3.8.55-2.75 2.68.65 3.78L8 10l-3.4 1.9.65-3.78L2.5 5.45l3.8-.55z"/>
  </svg>
);

export const IconTodo = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <rect x="2" y="2" width="12" height="12" rx="1.5"/>
    <polyline points="5,7.5 7,9.5 11,5.5"/>
    <line x1="5" y1="11.5" x2="11" y2="11.5"/>
  </svg>
);

export const IconX = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg {...base(size, color)}>
    <line x1="4" y1="4" x2="12" y2="12"/>
    <line x1="12" y1="4" x2="4" y2="12"/>
  </svg>
);

export const IconChevron = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg {...base(size, color)} style={style}>
    <polyline points="6,4 10,8 6,12"/>
  </svg>
);
