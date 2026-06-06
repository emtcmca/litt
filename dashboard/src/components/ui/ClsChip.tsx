import { Mono } from './Mono';

type DeadlineClass = 'HARD_LEGAL' | 'HARD_CONTRACTUAL' | 'SOFT_INTERNAL' | 'ADMINISTRATIVE';

interface ClsChipProps {
  cls: string;
  small?: boolean;
}

const CLS_META: Record<DeadlineClass, { label: string; color: string }> = {
  HARD_LEGAL:       { label: 'HARD_LEGAL',       color: '#9B2D23' },
  HARD_CONTRACTUAL: { label: 'HARD_CONTRACTUAL', color: '#A98435' },
  SOFT_INTERNAL:    { label: 'SOFT_INTERNAL',    color: '#1D9E75' },
  ADMINISTRATIVE:   { label: 'ADMINISTRATIVE',   color: '#5F6F66' },
};

export function ClsChip({ cls, small }: ClsChipProps) {
  const m = CLS_META[cls as DeadlineClass] ?? { label: cls, color: '#5F6F66' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: small ? '2px 7px' : '3px 9px',
      borderRadius: 6,
      border: `1px solid ${m.color}44`,
      background: `${m.color}10`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.color, flexShrink: 0 }} />
      <Mono style={{ fontSize: small ? 9 : 9.5, fontWeight: 600, letterSpacing: '.02em', color: m.color }}>
        {m.label.replace('HARD_', '').replace('SOFT_', '')}
      </Mono>
    </span>
  );
}
