import type { CSSProperties } from 'react';

export type IconName =
  | 'check' | 'arrow' | 'clock' | 'shield' | 'alert' | 'dollar'
  | 'mail' | 'chart' | 'chevron' | 'chevronD' | 'x' | 'book'
  | 'refresh' | 'lock' | 'grid' | 'sliders' | 'plug' | 'users' | 'dot';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, color = 'currentColor', stroke = 1.6, style }: IconProps) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const paths: Record<IconName, React.ReactNode> = {
    check:    <polyline points="3.5 8.5 7 12 12.5 4.5" {...p} />,
    arrow:    <g {...p}><line x1="3" y1="8" x2="13" y2="8" /><polyline points="9 4 13 8 9 12" /></g>,
    clock:    <g {...p}><circle cx="8" cy="8" r="6" /><polyline points="8 4.5 8 8 10.5 9.5" /></g>,
    shield:   <path d="M8 2 13 4v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" {...p} />,
    alert:    <g {...p}><path d="M8 2 15 14H1z" /><line x1="8" y1="6.5" x2="8" y2="9.5" /><circle cx="8" cy="11.6" r="0.2" /></g>,
    dollar:   <g {...p}><line x1="8" y1="2" x2="8" y2="14" /><path d="M11 4.5H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H4.5" /></g>,
    mail:     <g {...p}><rect x="2" y="3.5" width="12" height="9" rx="1.5" /><polyline points="2.5 4.5 8 9 13.5 4.5" /></g>,
    chart:    <g {...p}><line x1="3" y1="13" x2="13" y2="13" /><rect x="4" y="8" width="2" height="4" /><rect x="7.5" y="5" width="2" height="7" /><rect x="11" y="9" width="2" height="3" /></g>,
    chevron:  <polyline points="5 3.5 9.5 8 5 12.5" {...p} />,
    chevronD: <polyline points="3.5 6 8 10.5 12 6" {...p} />,
    x:        <g {...p}><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></g>,
    book:     <g {...p}><path d="M3 3.5h4.5a1.5 1.5 0 0 1 1.5 1.5v8a1.2 1.2 0 0 0-1.2-1.2H3z" /><path d="M13 3.5H8.5A1.5 1.5 0 0 0 7 5v8a1.2 1.2 0 0 1 1.2-1.2H13z" /></g>,
    refresh:  <g {...p}><path d="M13 8a5 5 0 1 1-1.4-3.5" /><polyline points="13 2.5 13 5 10.4 5" /></g>,
    lock:     <g {...p}><rect x="3.5" y="7" width="9" height="6.3" rx="1.3" /><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" /></g>,
    grid:     <g {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></g>,
    sliders:  <g {...p}><line x1="2.5" y1="5" x2="13.5" y2="5" /><line x1="2.5" y1="11" x2="13.5" y2="11" /><circle cx="10" cy="5" r="1.6" /><circle cx="6" cy="11" r="1.6" /></g>,
    plug:     <g {...p}><path d="M5.5 9.5 2.5 12.5M10.5 6.5l3-3" /><rect x="6" y="4.2" width="5.8" height="5.8" rx="1.5" transform="rotate(45 9 7)" /></g>,
    users:    <g {...p}><circle cx="6" cy="6" r="2.3" /><path d="M2.5 13c0-2 1.6-3.3 3.5-3.3S9.5 11 9.5 13" /><path d="M10.5 4.2a2.2 2.2 0 0 1 0 4.1M11 13c0-1.6-.8-2.8-2-3.2" /></g>,
    dot:      <circle cx="8" cy="8" r="3" fill={color} stroke="none" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {paths[name] ?? null}
    </svg>
  );
}
