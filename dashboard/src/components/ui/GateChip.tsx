import { Mono } from './Mono';
import { T } from '../../tokens';

type GateLevel = 'ESCALATION' | 'REVIEW_REQUIRED' | 'BLOCKED' | 'AUTO_SAFE';

interface GateChipProps {
  gate: GateLevel | string;
  mono?: boolean;
  size?: 'sm' | 'md';
}

const GATE_META: Record<GateLevel, { label: string; mono: string; fg: string; bg: string; bd: string }> = {
  ESCALATION:       { label: 'Needs you now', mono: 'ESCALATION',       fg: T.danger, bg: T.dangerSoft,           bd: 'rgba(155,45,35,.28)' },
  REVIEW_REQUIRED:  { label: 'Your call',     mono: 'REVIEW_REQUIRED',  fg: T.gold,   bg: 'rgba(169,132,53,.10)', bd: 'rgba(169,132,53,.30)' },
  BLOCKED:          { label: 'Prepared',      mono: 'BLOCKED',          fg: '#3A4A44', bg: 'rgba(20,34,31,.07)',   bd: 'rgba(20,34,31,.18)' },
  AUTO_SAFE:        { label: 'For the record', mono: 'AUTO_SAFE',       fg: T.teal,   bg: T.tealSoft,             bd: 'rgba(29,158,117,.26)' },
};

export function GateChip({ gate, mono = false, size = 'md' }: GateChipProps) {
  const m = GATE_META[gate as GateLevel];
  if (!m) return null;
  const pad = size === 'sm' ? '3px 8px' : '4px 10px';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: pad,
      borderRadius: 999,
      background: m.bg,
      color: m.fg,
      border: `1px solid ${m.bd}`,
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      lineHeight: 1.1,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.fg }} />
      {mono
        ? <Mono style={{ fontSize: 10.5, letterSpacing: '.02em', fontWeight: 600 }}>{m.mono}</Mono>
        : m.label
      }
    </span>
  );
}
