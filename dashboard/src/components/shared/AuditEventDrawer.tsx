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
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(29,158,117,0.4)',
      background: '#FFFFFF',
      boxShadow: '0 8px 40px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)',
    }}>
      {/* Green header */}
      <div style={{ padding: '12px 14px', background: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5DCAA5', fontSize: 13, fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Action logged to audit trail
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5DCAA5', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px', opacity: 0.8 }}>×</button>
      </div>
      {/* Light data rows */}
      <div style={{ background: '#FFFFFF', padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: '0 0 4px', color: '#1A2E28', fontSize: 14, lineHeight: 1.45 }}>
          Litt wrote the attorney decision to the append-only operational audit trail.
        </p>
        {[
          { label: 'event id', value: result.audit_event_id, mono: true, highlight: true },
          { label: 'entity',   value: `${result.entity_type} / ${result.entity_id}`, mono: true },
          { label: 'actor',    value: actor, mono: false },
          { label: 'at',       value: `${ts} UTC`, mono: false },
        ].map(({ label, value, mono, highlight }) => (
          <div key={label} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
            <span style={{ color: '#8A9A8E', width: 56, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{label}</span>
            <span style={{
              color: highlight ? '#085041' : '#4A5A4E',
              fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
              wordBreak: 'break-all',
              fontWeight: highlight ? 600 : 400,
            }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
