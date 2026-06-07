import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { T } from '../../tokens';
import type { ProofData } from './resolveTypes';

interface Props {
  proof: ProofData;
  defaultOpen?: boolean;
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: T.faint,
  width: 72,
  flexShrink: 0,
  paddingTop: 1,
};

function Chip({ text, color }: { text: string; color?: string }) {
  if (!text) return null;
  return (
    <span style={{
      background: T.soft,
      borderRadius: 4,
      padding: '1px 7px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: color ?? T.muted,
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' }}>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'flex-start' }}>
        {children}
      </div>
    </div>
  );
}

export function ProofBlock({ proof, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const confColor = typeof proof.confidence === 'number' && proof.confidence >= 0.8
    ? T.teal
    : T.faint;

  return (
    <div style={{
      background: T.wash2,
      borderRadius: 10,
      border: `1px solid ${T.line}`,
      overflow: 'hidden',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Icon name="book" size={13} color={T.faint} />
        <span style={{
          flex: 1,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: T.faint,
          letterSpacing: '0.02em',
        }}>
          Show Litt's work — source, routing &amp; confidence
        </span>
        <span style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 160ms ease',
          display: 'flex',
        }}>
          <Icon name="chevronD" size={13} color={T.faint} />
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{
          padding: '0 14px 12px',
          borderTop: `1px solid ${T.line}`,
        }}>
          <Row label="Reading">
            <span style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
              {proof.what || '—'}
            </span>
          </Row>

          <Row label="Litt did">
            <span style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
              {proof.did || '—'}
            </span>
          </Row>

          <Row label="Source">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {proof.source.tag && <Chip text={proof.source.tag} />}
                {proof.source.ref && (
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: T.faint }}>
                    {proof.source.ref}
                  </span>
                )}
              </div>
              {proof.source.line && (
                <p style={{
                  margin: 0,
                  fontSize: 12,
                  fontStyle: 'italic',
                  color: T.muted,
                  lineHeight: 1.55,
                  borderLeft: `2px solid ${T.tealSoft}`,
                  paddingLeft: 8,
                }}>
                  {proof.source.line}
                </p>
              )}
            </div>
          </Row>

          <Row label="Routing">
            {proof.route.agent && <Chip text={proof.route.agent} />}
            {proof.route.work  && <Chip text={proof.route.work} />}
            {proof.route.llm && proof.route.llm !== 'n/a' && (
              <Chip text={proof.route.llm} color={T.teal} />
            )}
            {typeof proof.confidence === 'number' && (
              <Chip text={`confidence: ${proof.confidence.toFixed(2)}`} color={confColor} />
            )}
            {proof.route.extra && <Chip text={proof.route.extra} />}
          </Row>
        </div>
      )}
    </div>
  );
}
