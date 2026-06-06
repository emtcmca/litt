const KIND_COLOR: Record<string, string> = {
  write:   '#9B2D23',
  compute: '#1D9E75',
  gemini:  'var(--color-ramp-blue-600)',
  read:    '#5C6B64',
};

interface ToolChipProps {
  name: string;
  kind: string;
}

export function ToolChip({ name, kind }: ToolChipProps) {
  const color = KIND_COLOR[kind] ?? KIND_COLOR.read;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 7px', borderRadius: 4,
      background: `${color}12`, border: `1px solid ${color}30`,
      maxWidth: 160,
    }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color, opacity: 0.7, flexShrink: 0 }}>
        {kind}
      </span>
    </div>
  );
}
