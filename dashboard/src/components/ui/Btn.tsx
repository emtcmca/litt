import type { CSSProperties, ReactNode, MouseEvent } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { T } from '../../tokens';

type BtnKind = 'primary' | 'teal' | 'ghost' | 'danger' | 'quiet';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps {
  children: ReactNode;
  kind?: BtnKind;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  size?: BtnSize;
  full?: boolean;
  icon?: IconName;
  style?: CSSProperties;
}

const SIZES: Record<BtnSize, string> = {
  sm: '7px 12px',
  md: '10px 16px',
  lg: '12px 18px',
};

const KINDS: Record<BtnKind, CSSProperties> = {
  primary: { background: T.forest, color: T.brass, border: `1px solid ${T.forest}` },
  teal:    { background: T.teal,   color: '#fff',  border: `1px solid ${T.teal}` },
  ghost:   { background: 'transparent', color: T.ink, border: `1px solid ${T.line}` },
  danger:  { background: 'transparent', color: T.danger, border: `1px solid rgba(155,45,35,.4)` },
  quiet:   { background: 'transparent', color: T.muted, border: '1px solid transparent' },
};

export function Btn({ children, kind = 'primary', onClick, disabled, size = 'md', full, icon, style }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: SIZES[size],
        borderRadius: 9,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: full ? '100%' : 'auto',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform .06s ease, filter .15s ease',
        fontFamily: 'var(--font-sans)',
        ...KINDS[kind],
        ...style,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(.98)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {icon && <Icon name={icon} size={15} color="currentColor" />}
      {children}
    </button>
  );
}
