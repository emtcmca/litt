/**
 * WarnNotice — brief-visible soft notice strip.
 * No approval gate. Dismissible by attorney.
 */

import { useState } from 'react';

interface WarnNoticeProps {
  message: string;
  /** Optional agent or source attribution */
  source?: string;
  onDismiss?: () => void;
}

export function WarnNotice({ message, source, onDismiss }: WarnNoticeProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div style={{
      display:      'flex',
      alignItems:   'start',
      gap:          10,
      padding:      '8px 10px',
      background:   'rgba(169,132,53,.06)',
      border:       '1px solid rgba(169,132,53,.3)',
      borderRadius: 8,
      marginTop:    6,
    }}>
      <span style={{ fontSize: 12, color: '#A98435', flexShrink: 0, marginTop: 1 }}>⚠</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#A98435', lineHeight: 1.4 }}>{message}</p>
        {source && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(169,132,53,.6)', marginTop: 2, display: 'block' }}>
            {source}
          </span>
        )}
      </div>
      <button
        onClick={() => { setDismissed(true); onDismiss?.(); }}
        aria-label="Dismiss notice"
        style={{
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          color:       'rgba(169,132,53,.5)',
          fontSize:    14,
          lineHeight:  1,
          padding:     2,
          flexShrink:  0,
        }}
      >
        ×
      </button>
    </div>
  );
}
