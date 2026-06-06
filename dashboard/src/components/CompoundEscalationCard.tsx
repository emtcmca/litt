/**
 * CompoundEscalationCard — displays a cross-agent compound risk escalation.
 * Shows contributing agents inferred from what_is_happening text, expandable detail.
 */

import { useState } from 'react';
import type { BriefCompoundEscalationItem } from '../types';

interface CompoundEscalationCardProps {
  item: BriefCompoundEscalationItem;
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: 'rgba(155,45,35,.08)', color: '#9B2D23', border: 'rgba(155,45,35,.3)' },
  ELEVATED: { bg: 'rgba(169,132,53,.06)', color: '#A98435', border: 'rgba(169,132,53,.3)' },
};

export function CompoundEscalationCard({ item }: CompoundEscalationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLE[item.risk_level] ?? SEVERITY_STYLE.ELEVATED;

  return (
    <div style={{
      border:       `1px solid ${style.border}`,
      borderRadius: 10,
      background:   style.bg,
      overflow:     'hidden',
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width:       '100%',
          background:  'none',
          border:      'none',
          padding:     '10px 14px',
          cursor:      'pointer',
          textAlign:   'left',
          display:     'flex',
          alignItems:  'start',
          gap:         12,
        }}
      >
        {/* Severity badge */}
        <span style={{
          flexShrink:    0,
          background:    style.color,
          color:         '#FFFFFF',
          borderRadius:  5,
          padding:       '3px 7px',
          fontFamily:    'var(--font-mono)',
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: '0.04em',
          marginTop:     2,
        }}>
          {item.risk_level}
        </span>

        {/* Summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#14221F', lineHeight: 1.3 }}>
            Compound risk: {item.matter_id}
          </div>
          <div style={{ fontSize: 12, color: '#5C6B64', marginTop: 3, lineHeight: 1.4 }}>
            {item.what_is_happening}
          </div>
        </div>

        {/* Cross + expand toggle */}
        <span style={{ flexShrink: 0, fontSize: 11, color: style.color, fontFamily: 'var(--font-mono)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${style.border}`,
          padding:   '12px 14px',
          display:   'grid',
          gap:       10,
        }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5C6B64', marginBottom: 4 }}>
              Why it matters
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#14221F', lineHeight: 1.5 }}>
              {item.why_it_matters}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: style.color, marginBottom: 4 }}>
              Attorney decision required
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#14221F', lineHeight: 1.5 }}>
              {item.what_attorney_must_decide}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5C6B64' }}>
              matter: {item.matter_id}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5C6B64' }}>
              priority: {item.priority}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5C6B64' }}>
              {item.created_at ? item.created_at.slice(0, 10) : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
