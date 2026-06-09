import { T } from '../../tokens';

interface Props { visible: boolean }

function LegendLine({ stroke, dash }: { stroke: string; dash?: string }) {
  return (
    <svg width="20" height="6" style={{ display: 'block' }}>
      <line x1="1" y1="3" x2="19" y2="3" stroke={stroke} strokeWidth="1.6"
        strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

export function ArchitectureLegend({ visible }: Props) {
  if (!visible) return null;

  const items: { visual: React.ReactNode; label: string }[] = [
    { visual: <LegendLine stroke={T.forest} />,          label: 'Deterministic routing / tool call' },
    { visual: <LegendLine stroke={T.teal} dash="1.5 3" />, label: 'Gemini language task' },
    { visual: <LegendLine stroke={T.gold} />,            label: 'Attorney approval gate' },
    { visual: <span style={{ fontSize: 12, lineHeight: 1 }}>🔒</span>, label: 'Tool layer — no direct write path' },
    { visual: <span style={{ width: 8, height: 8, borderRadius: 999, background: T.danger, display: 'inline-block', flexShrink: 0 }} />, label: 'Legal escalation' },
  ];

  return (
    <div style={{
      position: 'absolute',
      left: 14,
      bottom: 68,
      zIndex: 4,
      background: 'rgba(255,255,255,.82)',
      backdropFilter: 'blur(4px)',
      border: `1px solid ${T.forest}33`,
      borderRadius: 9,
      padding: '8px 12px',
      display: 'grid',
      gap: 5,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {it.visual}
          </span>
          <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: T.muted }}>
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}
