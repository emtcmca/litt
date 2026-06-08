import type { CSSProperties, ReactNode } from 'react';
import { T } from '../../tokens';
import { Mono } from '../ui/Mono';

type Conf = 'high' | 'medium' | 'low' | 'not_found' | null;

const TONE: Record<string, string> = {
  high: T.teal,
  medium: T.gold,
  low: T.danger,
  not_found: T.faint,
};

const CHIP_LABEL: Record<string, string> = {
  high: 'stated',
  medium: 'implied',
  low: 'inferred',
  not_found: 'not found',
};

interface ConfidenceFieldProps {
  label: string;
  required?: boolean;
  conf: Conf;
  children: ReactNode;
  style?: CSSProperties;
}

export function ConfidenceField({ label, required, conf, children, style }: ConfidenceFieldProps) {
  const tone = conf ? (TONE[conf] ?? T.faint) : 'transparent';
  const chipLabel = conf ? (CHIP_LABEL[conf] ?? '') : null;

  return (
    <div style={{ display: 'grid', gap: 4, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>
          {label}{required && <span style={{ color: T.teal, marginLeft: 2 }}>*</span>}
        </label>
        {chipLabel && (
          <Mono style={{
            fontSize: 10, color: tone,
            background: conf === 'not_found' ? T.wash2 : 'transparent',
            padding: '1px 5px', borderRadius: 4,
          }}>
            {chipLabel}
          </Mono>
        )}
      </div>
      <div style={{ borderLeft: `3px solid ${tone}`, paddingLeft: 0 }}>
        {children}
      </div>
    </div>
  );
}

const INPUT_BASE: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px',
  fontSize: 13, color: T.ink,
  border: `1px solid ${T.line}`,
  borderRadius: 7, outline: 'none',
  fontFamily: 'var(--font-sans)',
};

interface FieldInputProps {
  value: string;
  onChange: (v: string) => void;
  conf: Conf;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

export function FieldInput({ value, onChange, conf, placeholder, type = 'text', required }: FieldInputProps) {
  const isNotFound = conf === 'not_found';
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      placeholder={isNotFound ? 'Attorney to add…' : placeholder}
      style={{
        ...INPUT_BASE,
        background: isNotFound ? T.wash2 : T.surface,
      }}
    />
  );
}

interface FieldSelectProps {
  value: string;
  onChange: (v: string) => void;
  conf: Conf;
  options: { value: string; label: string }[];
  required?: boolean;
}

export function FieldSelect({ value, onChange, conf, options, required }: FieldSelectProps) {
  const isNotFound = conf === 'not_found';
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      style={{
        ...INPUT_BASE,
        background: isNotFound ? T.wash2 : T.surface,
        cursor: 'pointer',
        appearance: 'auto',
      }}
    >
      {isNotFound && <option value="">Attorney to add…</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
