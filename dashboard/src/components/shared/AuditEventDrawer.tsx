import { useEffect } from 'react';
import type { ToolResult } from '../../types';

interface Props {
  result: ToolResult | null;
  onClose: () => void;
}

export function AuditEventDrawer({ result, onClose }: Props) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [result, onClose]);

  if (!result) return null;

  const ts = (result.data?.timestamp as string | undefined)
    ?.slice(0, 19).replace('T', ' ')
    ?? new Date().toISOString().slice(0, 19).replace('T', ' ');
  const actor = (result.data?.actor as string | undefined) ?? '—';

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 60,
      width: 360,
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
      border: '0.5px solid rgba(255,255,255,0.12)',
      background: 'var(--color-audit-surface)',
    }}>
      {/* Green header */}
      <div style={{ padding: '12px 14px', background: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-audit-success)', fontSize: 13, fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Action logged
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-audit-success)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px', opacity: 0.7 }}>×</button>
      </div>
      {/* Dark data rows */}
      <div style={{ background: 'var(--color-audit-surface)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: '0 0 4px', color: '#E8E6DC', fontSize: 14, lineHeight: 1.45 }}>
          Litt wrote the attorney decision to the append-only operational audit trail.
        </p>
        {[
          { label: 'event id', value: result.audit_event_id, mono: true, highlight: true },
          { label: 'entity',   value: `${result.entity_type} / ${result.entity_id}`, mono: true },
          { label: 'actor',    value: actor, mono: false },
          { label: 'at',       value: `${ts} UTC`, mono: false },
        ].map(({ label, value, mono, highlight }) => (
          <div key={label} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
            <span style={{ color: '#5F5E5A', width: 56, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{label}</span>
            <span style={{
              color: highlight ? 'var(--color-audit-success)' : '#A9A7A1',
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
              wordBreak: 'break-all',
            }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
